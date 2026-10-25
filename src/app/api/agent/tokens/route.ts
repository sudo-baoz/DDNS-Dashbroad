import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateRandomToken, hashToken } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {

  const agents = await prisma.remoteAgent.findMany({
    select: {
      id: true,
      name: true,
      lastReportedIp: true,
      lastSeenAt: true,
      createdAt: true,
      _count: {
        select: {
          jobs: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ agents });
}

export async function POST(req: NextRequest) {

  try {
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Agent name is required.' }, { status: 400 });
    }

    const rawToken = `pulse_${generateRandomToken(32)}`;
    const tokenHash = hashToken(rawToken);

    const agent = await prisma.remoteAgent.create({
      data: {
        name: name.trim(),
        tokenHash,
      },
    });

    await logAudit({
      action: 'AGENT_TOKEN_CREATE',
      severity: 'INFO',
      description: `Created remote agent token for "${agent.name}".`,
      metadata: { agentId: agent.id, name: agent.name },
    });

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        createdAt: agent.createdAt,
      },
      token: rawToken, // Displayed once to user
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to create agent token.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Agent ID is required.' }, { status: 400 });
    }

    const agent = await prisma.remoteAgent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }

    await prisma.remoteAgent.delete({ where: { id } });

    await logAudit({
      action: 'AGENT_TOKEN_REVOKE',
      severity: 'WARN',
      description: `Revoked remote agent token for "${agent.name}".`,
      metadata: { agentId: id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to delete agent.' },
      { status: 500 }
    );
  }
}
