import { NextRequest, NextResponse } from 'next/server';
import { retryDeliveryById, processNotificationQueueBatch } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updated = await retryDeliveryById(params.id);

    // Trigger immediate batch processing
    processNotificationQueueBatch().catch(() => {});

    await logAudit({
      action: 'SETTINGS_UPDATE',
      severity: 'INFO',
      description: `Retried notification delivery "${updated.title}" (${updated.id}).`,
      metadata: { deliveryId: updated.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification delivery has been requeued for immediate processing.',
      delivery: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to requeue notification delivery.' },
      { status: 500 }
    );
  }
}
