import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sanitizeLogMessage } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const status = searchParams.get('status');
    const eventType = searchParams.get('eventType');
    const search = searchParams.get('search')?.trim();

    const where: any = {};

    if (status && ['PENDING', 'SENDING', 'SENT', 'RETRYING', 'FAILED', 'CANCELLED'].includes(status)) {
      where.status = status;
    }

    if (eventType) {
      where.eventType = eventType;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { domain: { contains: search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.notificationDelivery.count({ where }),
      prisma.notificationDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const sanitizedDeliveries = items.map((item) => ({
      id: item.id,
      eventType: item.eventType,
      severity: item.severity,
      title: item.title,
      description: item.description,
      domain: item.domain,
      status: item.status,
      attemptCount: item.attemptCount,
      maxAttempts: item.maxAttempts,
      nextAttemptAt: item.nextAttemptAt,
      lastError: sanitizeLogMessage(item.lastError || ''),
      responseCode: item.responseCode,
      sentAt: item.sentAt,
      createdAt: item.createdAt,
    }));

    return NextResponse.json({
      success: true,
      deliveries: sanitizedDeliveries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch notification history.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const count = await prisma.notificationDelivery.deleteMany();

    await logAudit({
      action: 'SETTINGS_UPDATE',
      severity: 'INFO',
      description: `Cleared ${count.count} notification delivery history records.`,
    });

    return NextResponse.json({
      success: true,
      message: `Cleared ${count.count} delivery records.`,
      count: count.count,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to clear notification history.' },
      { status: 500 }
    );
  }
}
