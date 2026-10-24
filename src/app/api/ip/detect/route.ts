import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { detectPublicIPv4, detectPublicIPv6 } from '@/lib/ip-detector';

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const settings = await prisma.applicationSettings.findUnique({ where: { id: 'default' } });
  const ipv4Urls = settings?.ipv4SourceUrls
    ? settings.ipv4SourceUrls.split(',').map((s) => s.trim())
    : undefined;
  const ipv6Urls = settings?.ipv6SourceUrls
    ? settings.ipv6SourceUrls.split(',').map((s) => s.trim())
    : undefined;

  const timeoutMs = (settings?.requestTimeoutSec || 5) * 1000;

  const [v4Result, v6Result] = await Promise.all([
    detectPublicIPv4(ipv4Urls, timeoutMs),
    detectPublicIPv6(ipv6Urls, timeoutMs),
  ]);

  return NextResponse.json({
    ipv4: v4Result.ip,
    ipv4Service: v4Result.serviceUsed,
    ipv4LatencyMs: v4Result.latencyMs,
    ipv4Error: v4Result.error,
    ipv6: v6Result.ip,
    ipv6Service: v6Result.serviceUsed,
    ipv6LatencyMs: v6Result.latencyMs,
    ipv6Error: v6Result.error,
    timestamp: new Date().toISOString(),
  });
}
