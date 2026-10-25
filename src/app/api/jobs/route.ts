import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const jobs = await prisma.ddnsJob.findMany({
    include: {
      record: {
        include: {
          zone: true,
          provider: true,
        },
      },
      remoteAgent: {
        select: {
          id: true,
          name: true,
          lastReportedIp: true,
          lastSeenAt: true,
        },
      },
      executions: {
        take: 5,
        orderBy: { executedAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {

  try {
    const body = await req.json();
    const {
      name,
      recordId,
      ipVersion = 'IPv4',
      sourceMode = 'SERVER_IP',
      remoteAgentId,
      intervalSeconds = 300,
      enabled = true,
    } = body;

    if (!name || !recordId) {
      return NextResponse.json(
        { error: 'Job name and target DNS record are required.' },
        { status: 400 }
      );
    }

    const record = await prisma.dnsRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      return NextResponse.json({ error: 'Target DNS record not found.' }, { status: 404 });
    }

    // Mark record as managed
    await prisma.dnsRecord.update({
      where: { id: recordId },
      data: { isManaged: true },
    });

    const job = await prisma.ddnsJob.create({
      data: {
        name: name.trim(),
        recordId,
        ipVersion,
        sourceMode,
        remoteAgentId: sourceMode === 'REMOTE_AGENT' ? remoteAgentId : null,
        intervalSeconds: Math.max(30, parseInt(intervalSeconds, 10) || 300),
        enabled: !!enabled,
        nextExecutionAt: new Date(), // run promptly
      },
      include: {
        record: true,
        remoteAgent: true,
      },
    });

    await logAudit({
      action: 'JOB_CREATE',
      severity: 'SUCCESS',
      description: `Created DDNS update job "${job.name}" for ${record.name} (${job.ipVersion}, ${job.intervalSeconds}s interval).`,
      metadata: { jobId: job.id, recordName: record.name },
    });

    return NextResponse.json({ success: true, job });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to create DDNS job.' },
      { status: 500 }
    );
  }
}
