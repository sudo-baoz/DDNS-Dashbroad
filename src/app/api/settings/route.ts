import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const [settings, zoneCount, recordCount, jobCount, executionCount] = await Promise.all([
    prisma.applicationSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    }),
    prisma.dnsZone.count(),
    prisma.dnsRecord.count(),
    prisma.ddnsJob.count(),
    prisma.ddnsExecution.count(),
  ]);

  const isWorkerLive = settings.workerHeartbeat
    ? Date.now() - new Date(settings.workerHeartbeat).getTime() < 45000
    : false;

  return NextResponse.json({
    settings,
    system: {
      version: '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      workerStatus: isWorkerLive ? 'active' : 'idle',
      lastHeartbeat: settings.workerHeartbeat,
      database: 'connected',
      stats: {
        zones: zoneCount,
        records: recordCount,
        jobs: jobCount,
        executions: executionCount,
      },
    },
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      dashboardName,
      timezone,
      defaultTheme,
      defaultInterval,
      ipv4SourceUrls,
      ipv6SourceUrls,
      requestTimeoutSec,
      maxRetries,
    } = body;

    const updateData: any = {};
    if (dashboardName !== undefined) updateData.dashboardName = dashboardName.trim();
    if (timezone !== undefined) updateData.timezone = timezone.trim();
    if (defaultTheme !== undefined) updateData.defaultTheme = defaultTheme;
    if (defaultInterval !== undefined) updateData.defaultInterval = Math.max(30, parseInt(defaultInterval, 10));
    if (ipv4SourceUrls !== undefined) updateData.ipv4SourceUrls = ipv4SourceUrls.trim();
    if (ipv6SourceUrls !== undefined) updateData.ipv6SourceUrls = ipv6SourceUrls.trim();
    if (requestTimeoutSec !== undefined) updateData.requestTimeoutSec = Math.max(2, parseInt(requestTimeoutSec, 10));
    if (maxRetries !== undefined) updateData.maxRetries = Math.max(1, parseInt(maxRetries, 10));

    const updated = await prisma.applicationSettings.upsert({
      where: { id: 'default' },
      update: updateData,
      create: { id: 'default', ...updateData },
    });

    await logAudit({
      action: 'SETTINGS_UPDATE',
      severity: 'INFO',
      description: 'Application settings updated.',
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update settings.' },
      { status: 500 }
    );
  }
}
