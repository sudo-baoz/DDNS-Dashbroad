import { NextRequest, NextResponse } from 'next/server';
import { notificationService, maskWebhookUrl } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';

export async function GET() {
  try {
    const { settings, maskedWebhookUrl, isConfigured } = await notificationService.getSettings();

    // Sanitize settings to prevent leaking encrypted credentials or iv/tag
    const safeSettings = {
      id: settings.id,
      enabled: settings.enabled,
      provider: settings.provider,
      webhookUrlMasked: maskedWebhookUrl,
      isConfigured,
      botName: settings.botName,
      avatarUrl: settings.avatarUrl,
      minSeverity: settings.minSeverity,
      cooldownSeconds: settings.cooldownSeconds,
      errorThreshold: settings.errorThreshold,
      includeIpAddresses: settings.includeIpAddresses,
      timezone: settings.timezone,
      quietHoursEnabled: settings.quietHoursEnabled,
      quietHoursStart: settings.quietHoursStart,
      quietHoursEnd: settings.quietHoursEnd,
      periodicSummaryEnabled: settings.periodicSummaryEnabled,
      periodicSummarySchedule: settings.periodicSummarySchedule,
      notifyIpChange: settings.notifyIpChange,
      notifyDnsSuccess: settings.notifyDnsSuccess,
      notifyDnsFailure: settings.notifyDnsFailure,
      notifyConnectionLost: settings.notifyConnectionLost,
      notifyConnectionRecovered: settings.notifyConnectionRecovered,
      notifyJobStatus: settings.notifyJobStatus,
      notifyAgentStatus: settings.notifyAgentStatus,
      notifySystemStartup: settings.notifySystemStartup,
      status: settings.status,
      statusMessage: settings.statusMessage,
      lastTestedAt: settings.lastTestedAt,
      lastDeliveredAt: settings.lastDeliveredAt,
      lastFailedAt: settings.lastFailedAt,
      updatedAt: settings.updatedAt,
    };

    return NextResponse.json({ success: true, settings: safeSettings });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch notification settings.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    const updated = await notificationService.updateSettings(body);
    const { maskedWebhookUrl, isConfigured } = await notificationService.getSettings();

    await logAudit({
      action: 'SETTINGS_UPDATE',
      severity: 'INFO',
      description: 'Updated Discord notification configuration.',
      metadata: {
        enabled: updated.enabled,
        status: updated.status,
        isConfigured,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification settings updated successfully.',
      settings: {
        id: updated.id,
        enabled: updated.enabled,
        provider: updated.provider,
        webhookUrlMasked: maskedWebhookUrl,
        isConfigured,
        botName: updated.botName,
        avatarUrl: updated.avatarUrl,
        minSeverity: updated.minSeverity,
        cooldownSeconds: updated.cooldownSeconds,
        errorThreshold: updated.errorThreshold,
        includeIpAddresses: updated.includeIpAddresses,
        timezone: updated.timezone,
        quietHoursEnabled: updated.quietHoursEnabled,
        quietHoursStart: updated.quietHoursStart,
        quietHoursEnd: updated.quietHoursEnd,
        periodicSummaryEnabled: updated.periodicSummaryEnabled,
        periodicSummarySchedule: updated.periodicSummarySchedule,
        notifyIpChange: updated.notifyIpChange,
        notifyDnsSuccess: updated.notifyDnsSuccess,
        notifyDnsFailure: updated.notifyDnsFailure,
        notifyConnectionLost: updated.notifyConnectionLost,
        notifyConnectionRecovered: updated.notifyConnectionRecovered,
        notifyJobStatus: updated.notifyJobStatus,
        notifyAgentStatus: updated.notifyAgentStatus,
        notifySystemStartup: updated.notifySystemStartup,
        status: updated.status,
        statusMessage: updated.statusMessage,
        lastTestedAt: updated.lastTestedAt,
        lastDeliveredAt: updated.lastDeliveredAt,
        lastFailedAt: updated.lastFailedAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update notification settings.' },
      { status: 400 }
    );
  }
}
