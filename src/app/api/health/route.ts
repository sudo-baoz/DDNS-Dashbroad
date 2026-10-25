import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check DB
    await prisma.$queryRaw`SELECT 1`;
    const settings = await prisma.applicationSettings.findUnique({ where: { id: 'default' } });

    const isWorkerLive = settings?.workerHeartbeat
      ? Date.now() - new Date(settings.workerHeartbeat).getTime() < 45000
      : false;

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      worker: isWorkerLive ? 'active' : 'idle',
      lastHeartbeat: settings?.workerHeartbeat || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: err.message || 'Healthcheck failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
