import prisma from '../prisma';
import { encryptText, decryptText } from '../crypto';
import {
  NotificationEvent,
  DiscordWebhookPayload,
  DeliveryResult,
} from './types';
import { validateDiscordWebhookUrl, maskWebhookUrl, sanitizeLogMessage } from './ssrf';
import { buildDiscordEmbed, buildTestWebhookPayload, buildWebhookPayload } from './embed-builder';
import { evaluateAntiSpam } from './anti-spam';
import { enqueueNotification } from './queue';
import { discordClient } from './discord-client';

export class NotificationService {
  /**
   * Get or create notification settings singleton.
   */
  async getSettings() {
    let settings = await prisma.notificationSetting.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.notificationSetting.create({
        data: {
          id: 'default',
          enabled: false,
          provider: 'discord',
          botName: 'PulseDNS',
          timezone: 'Asia/Ho_Chi_Minh',
          minSeverity: 'INFO',
          cooldownSeconds: 60,
          errorThreshold: 1,
          includeIpAddresses: true,
          status: 'NOT_CONFIGURED',
        },
      });
    }

    let decryptedWebhookUrl: string | null = null;
    let maskedWebhookUrl = '';

    if (settings.encryptedWebhookUrl && settings.webhookIv && settings.webhookTag) {
      try {
        decryptedWebhookUrl = decryptText(
          settings.encryptedWebhookUrl,
          settings.webhookIv,
          settings.webhookTag
        );
        maskedWebhookUrl = maskWebhookUrl(decryptedWebhookUrl);
      } catch (err) {
        console.error('[NotificationService] Failed to decrypt stored webhook URL:', err);
      }
    }

    return {
      settings,
      decryptedWebhookUrl,
      maskedWebhookUrl,
      isConfigured: Boolean(decryptedWebhookUrl),
    };
  }

  /**
   * Update notification settings.
   */
  async updateSettings(data: {
    enabled?: boolean;
    webhookUrl?: string | null;
    removeWebhook?: boolean;
    botName?: string;
    avatarUrl?: string | null;
    minSeverity?: string;
    cooldownSeconds?: number;
    errorThreshold?: number;
    includeIpAddresses?: boolean;
    timezone?: string;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    periodicSummaryEnabled?: boolean;
    periodicSummarySchedule?: string;
    notifyIpChange?: boolean;
    notifyDnsSuccess?: boolean;
    notifyDnsFailure?: boolean;
    notifyConnectionLost?: boolean;
    notifyConnectionRecovered?: boolean;
    notifyJobStatus?: boolean;
    notifyAgentStatus?: boolean;
    notifySystemStartup?: boolean;
  }) {
    const updatePayload: Record<string, any> = {};

    if (data.removeWebhook) {
      updatePayload.encryptedWebhookUrl = null;
      updatePayload.webhookIv = null;
      updatePayload.webhookTag = null;
      updatePayload.status = 'NOT_CONFIGURED';
      updatePayload.statusMessage = 'Webhook URL has been removed.';
    } else if (data.webhookUrl) {
      const validation = validateDiscordWebhookUrl(data.webhookUrl);
      if (!validation.valid || !validation.sanitizedUrl) {
        throw new Error(validation.reason || 'Invalid Discord Webhook URL.');
      }

      const encrypted = encryptText(validation.sanitizedUrl);
      updatePayload.encryptedWebhookUrl = encrypted.encrypted;
      updatePayload.webhookIv = encrypted.iv;
      updatePayload.webhookTag = encrypted.tag;
      updatePayload.status = 'CONNECTED';
      updatePayload.statusMessage = 'Webhook URL configured.';
    }

    const simpleFields = [
      'enabled',
      'botName',
      'avatarUrl',
      'minSeverity',
      'cooldownSeconds',
      'errorThreshold',
      'includeIpAddresses',
      'timezone',
      'quietHoursEnabled',
      'quietHoursStart',
      'quietHoursEnd',
      'periodicSummaryEnabled',
      'periodicSummarySchedule',
      'notifyIpChange',
      'notifyDnsSuccess',
      'notifyDnsFailure',
      'notifyConnectionLost',
      'notifyConnectionRecovered',
      'notifyJobStatus',
      'notifyAgentStatus',
      'notifySystemStartup',
    ] as const;

    for (const field of simpleFields) {
      if (data[field] !== undefined) {
        updatePayload[field] = data[field];
      }
    }

    const updated = await prisma.notificationSetting.upsert({
      where: { id: 'default' },
      update: updatePayload,
      create: {
        id: 'default',
        ...updatePayload,
      },
    });

    return updated;
  }

  /**
   * Dispatch an event to the notification subsystem.
   * This evaluates anti-spam, builds embeds, and enqueues to the persistent outbox.
   * NEVER throws or blocks caller execution.
   */
  async dispatch(event: NotificationEvent): Promise<boolean> {
    try {
      const { settings, isConfigured } = await this.getSettings();

      if (!settings.enabled || !isConfigured) {
        return false;
      }

      // Evaluate anti-spam rules
      const decision = await evaluateAntiSpam(event, {
        enabled: settings.enabled,
        minSeverity: settings.minSeverity,
        cooldownSeconds: settings.cooldownSeconds,
        errorThreshold: settings.errorThreshold,
        quietHoursEnabled: settings.quietHoursEnabled,
        quietHoursStart: settings.quietHoursStart,
        quietHoursEnd: settings.quietHoursEnd,
        timezone: settings.timezone,
        notifyIpChange: settings.notifyIpChange,
        notifyDnsSuccess: settings.notifyDnsSuccess,
        notifyDnsFailure: settings.notifyDnsFailure,
        notifyConnectionLost: settings.notifyConnectionLost,
        notifyConnectionRecovered: settings.notifyConnectionRecovered,
        notifyJobStatus: settings.notifyJobStatus,
        notifyAgentStatus: settings.notifyAgentStatus,
        notifySystemStartup: settings.notifySystemStartup,
      });

      if (!decision.shouldSend) {
        return false;
      }

      if (decision.outageDurationSeconds !== undefined) {
        event.outageDurationSeconds = decision.outageDurationSeconds;
      }

      // Build structured Discord embed
      const embed = buildDiscordEmbed(event, {
        includeIpAddresses: settings.includeIpAddresses,
        timezone: settings.timezone,
        botName: settings.botName,
        avatarUrl: settings.avatarUrl || undefined,
      });

      const payload = buildWebhookPayload([embed], {
        botName: settings.botName,
        avatarUrl: settings.avatarUrl || undefined,
      });

      // Enqueue to persistent SQLite outbox
      await enqueueNotification({
        eventType: event.type,
        severity: event.severity,
        title: embed.title,
        description: embed.description || event.description,
        domain: event.domain,
        payload,
      });

      return true;
    } catch (err) {
      console.error('[NotificationService] Error dispatching notification event:', err);
      return false;
    }
  }

  /**
   * Test webhook connectivity.
   */
  async testWebhook(customUrl?: string): Promise<DeliveryResult> {
    let webhookUrl: string | null = null;
    const { settings, decryptedWebhookUrl } = await this.getSettings();

    if (customUrl) {
      const validation = validateDiscordWebhookUrl(customUrl);
      if (!validation.valid || !validation.sanitizedUrl) {
        return {
          success: false,
          error: validation.reason || 'Invalid Discord Webhook URL.',
          isPermanentFailure: true,
        };
      }
      webhookUrl = validation.sanitizedUrl;
    } else {
      webhookUrl = decryptedWebhookUrl;
    }

    if (!webhookUrl) {
      return {
        success: false,
        error: 'No Discord Webhook URL is configured.',
        isPermanentFailure: true,
      };
    }

    const payload = buildTestWebhookPayload({
      botName: settings.botName,
      avatarUrl: settings.avatarUrl || undefined,
      timezone: settings.timezone,
    });

    const result = await discordClient.send(webhookUrl, payload, { wait: true, timeoutMs: 10000 });

    // Update settings status
    let status = 'CONNECTED';
    let statusMessage = 'Webhook verified successfully.';

    if (!result.success) {
      if (result.statusCode === 429) {
        status = 'RATE_LIMITED';
        statusMessage = result.error || 'Discord rate limit active.';
      } else if (result.isPermanentFailure) {
        status = 'INVALID_WEBHOOK';
        statusMessage = result.error || 'Invalid or revoked webhook token.';
      } else {
        status = 'DELIVERY_FAILED';
        statusMessage = result.error || 'Failed to deliver test message to Discord.';
      }
    }

    await prisma.notificationSetting.upsert({
      where: { id: 'default' },
      update: {
        status,
        statusMessage: sanitizeLogMessage(statusMessage),
        lastTestedAt: new Date(),
      },
      create: {
        id: 'default',
        status,
        statusMessage: sanitizeLogMessage(statusMessage),
        lastTestedAt: new Date(),
      },
    });

    return result;
  }

  /**
   * Generate periodic status digest.
   */
  async generatePeriodicDigest(): Promise<boolean> {
    try {
      const { settings } = await this.getSettings();
      if (!settings.enabled || !settings.periodicSummaryEnabled) {
        return false;
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [managedZones, activeJobs, executions, ipChanges, providers] = await Promise.all([
        prisma.dnsZone.count(),
        prisma.ddnsJob.count({ where: { enabled: true } }),
        prisma.ddnsExecution.findMany({
          where: { executedAt: { gte: since } },
          select: { status: true },
        }),
        prisma.ipHistory.count({
          where: { changedAt: { gte: since } },
        }),
        prisma.providerIntegration.findMany({
          select: { name: true, provider: true },
        }),
      ]);

      const successfulUpdates = executions.filter((e: { status: string }) => e.status === 'SUCCESS').length;
      const failedUpdates = executions.filter((e: { status: string }) => e.status === 'FAILED').length;
      const providerHealth = providers.length > 0 ? `${providers.length} Connected` : 'None';

      const event: NotificationEvent = {
        type: 'PERIODIC_SUMMARY',
        severity: 'INFO',
        title: '📊 PulseDNS Status Digest',
        description: '24-hour DDNS monitoring digest.',
        metadata: {
          managedDomains: managedZones,
          activeJobs,
          successfulUpdates,
          failedUpdates,
          ipChanges,
          providerHealth,
        },
      };

      await this.dispatch(event);

      await prisma.notificationSetting.update({
        where: { id: 'default' },
        data: { lastSummaryAt: new Date() },
      });

      return true;
    } catch (err) {
      console.error('[NotificationService] Error generating status digest:', err);
      return false;
    }
  }
}

export const notificationService = new NotificationService();
