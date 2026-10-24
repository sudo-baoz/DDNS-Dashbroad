import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { executeDDNSJob } from '@/lib/ddns-engine';
import { logAudit } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const result = await executeDDNSJob(params.id, { force: true });

    await logAudit({
      action: 'JOB_EXECUTE',
      severity: result.status === 'FAILED' ? 'ERROR' : 'SUCCESS',
      description: `Manual execution of job ${params.id}: ${result.message}`,
      metadata: { ...result },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to trigger job execution.' },
      { status: 500 }
    );
  }
}
