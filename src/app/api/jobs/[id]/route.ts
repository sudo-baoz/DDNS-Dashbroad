import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const job = await prisma.ddnsJob.findUnique({
    where: { id: params.id },
    include: {
      record: {
        include: {
          zone: true,
          provider: true,
        },
      },
      remoteAgent: true,
      executions: {
        take: 50,
        orderBy: { executedAt: 'desc' },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { name, enabled, intervalSeconds, sourceMode, remoteAgentId, ipVersion } = body;

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (typeof enabled === 'boolean') updateData.enabled = enabled;
    if (intervalSeconds) updateData.intervalSeconds = Math.max(30, parseInt(intervalSeconds, 10));
    if (sourceMode) {
      updateData.sourceMode = sourceMode;
      updateData.remoteAgentId = sourceMode === 'REMOTE_AGENT' ? remoteAgentId : null;
    }
    if (ipVersion) updateData.ipVersion = ipVersion;

    const job = await prisma.ddnsJob.update({
      where: { id: params.id },
      data: updateData,
    });

    await logAudit({
      action: 'JOB_UPDATE',
      severity: 'INFO',
      description: `Updated DDNS job "${job.name}" settings.`,
      metadata: { jobId: job.id },
    });

    return NextResponse.json({ success: true, job });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update job.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const job = await prisma.ddnsJob.findUnique({
      where: { id: params.id },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }

    await prisma.ddnsJob.delete({
      where: { id: params.id },
    });

    await logAudit({
      action: 'JOB_DELETE',
      severity: 'INFO',
      description: `Deleted DDNS job "${job.name}".`,
      metadata: { jobId: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to delete job.' },
      { status: 500 }
    );
  }
}
