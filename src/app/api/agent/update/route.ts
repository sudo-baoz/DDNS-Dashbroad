import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashToken } from '@/lib/crypto';
import { isValidIPv4, isValidIPv6 } from '@/lib/ip-detector';
import { executeDDNSJob } from '@/lib/ddns-engine';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate remote agent token
    const authHeader = req.headers.get('authorization') || '';
    const customHeader = req.headers.get('x-pulsedns-key') || '';

    let token = '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (customHeader) {
      token = customHeader.trim();
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide Bearer token or X-PulseDNS-Key header.' },
        { status: 401 }
      );
    }

    const tokenHash = hashToken(token);
    const agent = await prisma.remoteAgent.findUnique({
      where: { tokenHash },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid or revoked agent credentials.' },
        { status: 401 }
      );
    }

    // 2. Extract Reported IP
    let reportedIp: string | null = null;
    try {
      const body = await req.json();
      if (body && body.ip && typeof body.ip === 'string') {
        reportedIp = body.ip.trim();
      }
    } catch {
      // Body may be empty or not JSON
    }

    // If no explicit IP was provided in JSON, use the client request IP
    if (!reportedIp) {
      const forwarded = req.headers.get('x-forwarded-for');
      if (forwarded) {
        reportedIp = forwarded.split(',')[0].trim();
      } else {
        reportedIp = req.headers.get('x-real-ip')?.trim() || null;
      }
    }

    if (!reportedIp || (!isValidIPv4(reportedIp) && !isValidIPv6(reportedIp))) {
      return NextResponse.json(
        { error: `Invalid IP address detected: "${reportedIp || 'null'}"` },
        { status: 400 }
      );
    }

    // 3. Update agent status
    await prisma.remoteAgent.update({
      where: { id: agent.id },
      data: {
        lastReportedIp: reportedIp,
        lastSeenAt: new Date(),
      },
    });

    // 4. Trigger all active DDNS jobs bound to this agent
    const boundJobs = await prisma.ddnsJob.findMany({
      where: {
        remoteAgentId: agent.id,
        sourceMode: 'REMOTE_AGENT',
        enabled: true,
      },
    });

    const results = [];
    for (const job of boundJobs) {
      const res = await executeDDNSJob(job.id, { explicitIp: reportedIp });
      results.push(res);
    }

    await logAudit({
      action: 'IP_CHANGE',
      severity: 'INFO',
      description: `Remote agent "${agent.name}" reported IP ${reportedIp}. Triggered ${boundJobs.length} bound DDNS jobs.`,
      metadata: {
        agentId: agent.id,
        reportedIp,
        jobsTriggered: boundJobs.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `IP ${reportedIp} recorded from agent "${agent.name}".`,
      reportedIp,
      jobsExecuted: results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to process remote agent update.' },
      { status: 500 }
    );
  }
}
