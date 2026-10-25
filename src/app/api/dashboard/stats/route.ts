import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {

  const now = new Date();

  // Aggregate stats in parallel
  const [
    zoneCount,
    managedRecordCount,
    healthyRecordCount,
    failedRecordCount,
    lastSuccessfulExecution,
    connectedProviders,
    nextJob,
    recentExecutions,
    recentLogs,
    settings,
  ] = await Promise.all([
    prisma.dnsZone.count(),
    prisma.dnsRecord.count({ where: { isManaged: true } }),
    prisma.ddnsJob.count({ where: { enabled: true, status: 'SUCCESS' } }),
    prisma.ddnsJob.count({ where: { enabled: true, status: 'FAILED' } }),
    prisma.ddnsExecution.findFirst({
      where: { status: { in: ['SUCCESS', 'NO_CHANGE'] } },
      orderBy: { executedAt: 'desc' },
    }),
    prisma.providerIntegration.findMany({
      select: {
        id: true,
        name: true,
        provider: true,
        status: true,
        lastVerifiedAt: true,
      },
    }),
    prisma.ddnsJob.findFirst({
      where: { enabled: true, nextExecutionAt: { gt: now } },
      orderBy: { nextExecutionAt: 'asc' },
      select: { nextExecutionAt: true, name: true },
    }),
    prisma.ddnsExecution.findMany({
      take: 24,
      orderBy: { executedAt: 'desc' },
      include: {
        job: {
          select: {
            name: true,
            ipVersion: true,
            record: {
              select: { name: true },
            },
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.applicationSettings.findUnique({ where: { id: 'default' } }),
  ]);

  const isWorkerLive = settings?.workerHeartbeat
    ? Date.now() - new Date(settings.workerHeartbeat).getTime() < 45000
    : false;

  // Chart data: executions grouped by hour or chronological
  const activityData = [...recentExecutions].reverse().map((exec) => ({
    time: new Date(exec.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    success: exec.status === 'SUCCESS' ? 1 : 0,
    noChange: exec.status === 'NO_CHANGE' ? 1 : 0,
    failed: exec.status === 'FAILED' ? 1 : 0,
    durationMs: exec.durationMs,
  }));

  const cloudflareProvider = connectedProviders.find((p) => p.provider === 'cloudflare');

  return NextResponse.json({
    metrics: {
      totalDomains: zoneCount,
      activeDDNSRecords: managedRecordCount,
      healthyRecords: healthyRecordCount,
      failedRecords: failedRecordCount,
      lastSuccessfulUpdate: lastSuccessfulExecution?.executedAt || null,
      connectedProvidersCount: connectedProviders.filter((p) => p.status === 'CONNECTED').length,
      workerStatus: isWorkerLive ? 'active' : 'idle',
      lastHeartbeat: settings?.workerHeartbeat || null,
      nextScheduledCheck: nextJob?.nextExecutionAt || null,
      cloudflareStatus: cloudflareProvider ? cloudflareProvider.status : 'DISCONNECTED',
      cloudflareLastVerified: cloudflareProvider?.lastVerifiedAt || null,
    },
    activityData,
    recentActivity: recentLogs,
    connectedProviders,
  });
}
