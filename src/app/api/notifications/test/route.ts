import { NextRequest, NextResponse } from 'next/server';
import { notificationService, sanitizeLogMessage } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    let customWebhookUrl: string | undefined;

    try {
      const body = await req.json();
      if (body?.webhookUrl && typeof body.webhookUrl === 'string') {
        customWebhookUrl = body.webhookUrl.trim();
      }
    } catch {
      // Body may be empty if testing with saved webhook
    }

    const result = await notificationService.testWebhook(customWebhookUrl);

    await logAudit({
      action: 'SETTINGS_UPDATE',
      severity: result.success ? 'SUCCESS' : 'WARN',
      description: result.success
        ? 'Successfully sent test notification to Discord webhook.'
        : `Discord webhook test failed: ${sanitizeLogMessage(result.error || 'Unknown error')}`,
      metadata: {
        success: result.success,
        statusCode: result.statusCode,
      },
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test notification delivered successfully to Discord.',
        statusCode: result.statusCode,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: sanitizeLogMessage(result.error || 'Discord webhook test failed.'),
          statusCode: result.statusCode,
          isPermanentFailure: result.isPermanentFailure,
          retryAfterMs: result.retryAfterMs,
        },
        { status: result.isPermanentFailure ? 400 : 502 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: sanitizeLogMessage(err.message || 'Unexpected error during webhook test.'),
      },
      { status: 500 }
    );
  }
}
