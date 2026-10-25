import prisma from '../prisma';
import { NotificationEvent, NotificationSeverity } from './types';

const SEVERITY_LEVELS: Record<NotificationSeverity, number> = {
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SUCCESS: 1,
};

export interface AntiSpamDecision {
  shouldSend: boolean;
  reason?: string;
  outageDurationSeconds?: number;
}

/**
 * Checks whether current time falls within configured quiet hours (HH:mm format).
 */
export function isWithinQuietHours(
  start?: string | null,
  end?: string | null,
  timezone: string = 'Asia/Ho_Chi_Minh'
): boolean {
  if (!start || !end) return false;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(new Date());
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const currentMinutes = hour * 60 + minute;

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (startTotal <= endTotal) {
      // Normal range (e.g. 22:00 to 23:00)
      return currentMinutes >= startTotal && currentMinutes <= endTotal;
    } else {
      // Wraps around midnight (e.g. 22:00 to 06:00)
      return currentMinutes >= startTotal || currentMinutes <= endTotal;
    }
  } catch {
    return false;
  }
}

/**
 * Evaluates whether an event should be delivered based on:
 * 1. Event type toggles
 * 2. Severity threshold
 * 3. Quiet hours
 * 4. Cooldown window
 * 5. Provider outage / recovery state machine
 */
export async function evaluateAntiSpam(
  event: NotificationEvent,
  settings: {
    enabled: boolean;
    minSeverity: string;
    cooldownSeconds: number;
    errorThreshold: number;
    quietHoursEnabled: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    timezone: string;
    notifyIpChange: boolean;
    notifyDnsSuccess: boolean;
    notifyDnsFailure: boolean;
    notifyConnectionLost: boolean;
    notifyConnectionRecovered: boolean;
    notifyJobStatus: boolean;
    notifyAgentStatus: boolean;
    notifySystemStartup: boolean;
  }
): Promise<AntiSpamDecision> {
  if (!settings.enabled) {
    return { shouldSend: false, reason: 'Notifications are disabled.' };
  }

  // 1. Check Event Type Specific Toggles
  switch (event.type) {
    case 'PUBLIC_IP_CHANGED':
      if (!settings.notifyIpChange) return { shouldSend: false, reason: 'IP change notifications are disabled.' };
      break;
    case 'DNS_UPDATE_SUCCESS':
      if (!settings.notifyDnsSuccess) return { shouldSend: false, reason: 'DNS update success notifications are disabled.' };
      break;
    case 'DNS_UPDATE_FAILED':
      if (!settings.notifyDnsFailure) return { shouldSend: false, reason: 'DNS update failure notifications are disabled.' };
      break;
    case 'PROVIDER_CONNECTION_LOST':
      if (!settings.notifyConnectionLost) return { shouldSend: false, reason: 'Connection lost notifications are disabled.' };
      break;
    case 'PROVIDER_CONNECTION_RECOVERED':
      if (!settings.notifyConnectionRecovered) return { shouldSend: false, reason: 'Connection recovery notifications are disabled.' };
      break;
    case 'JOB_STATUS_CHANGED':
      if (!settings.notifyJobStatus) return { shouldSend: false, reason: 'Job status notifications are disabled.' };
      break;
    case 'AGENT_STATUS_CHANGED':
      if (!settings.notifyAgentStatus) return { shouldSend: false, reason: 'Agent status notifications are disabled.' };
      break;
    case 'SYSTEM_STARTUP':
      if (!settings.notifySystemStartup) return { shouldSend: false, reason: 'System startup notifications are disabled.' };
      break;
  }

  // 2. Check Severity Threshold
  const eventLevel = SEVERITY_LEVELS[event.severity] || 1;
  const minLevel = SEVERITY_LEVELS[settings.minSeverity as NotificationSeverity] || 1;
  if (eventLevel < minLevel) {
    return {
      shouldSend: false,
      reason: `Event severity ${event.severity} is below minimum threshold ${settings.minSeverity}.`,
    };
  }

  // 3. Quiet Hours Check
  if (settings.quietHoursEnabled) {
    const inQuietHours = isWithinQuietHours(
      settings.quietHoursStart,
      settings.quietHoursEnd,
      settings.timezone
    );
    if (inQuietHours && event.severity !== 'ERROR') {
      return {
        shouldSend: false,
        reason: 'Suppressed during configured quiet hours.',
      };
    }
  }

  // 4. Provider Connection Lost / Recovered State Machine
  if (event.type === 'PROVIDER_CONNECTION_LOST') {
    const stateKey = `provider:${event.provider || 'cloudflare'}:connection`;
    const currentState = await prisma.notificationState.findUnique({
      where: { key: stateKey },
    });

    const failureCount = (currentState?.failureCount || 0) + 1;
    const isCurrentlyDown = currentState?.state === 'DOWN';

    if (failureCount < settings.errorThreshold) {
      await prisma.notificationState.upsert({
        where: { key: stateKey },
        update: { failureCount },
        create: {
          key: stateKey,
          state: 'HEALTHY',
          failureCount,
          lastNotifiedAt: new Date(),
        },
      });
      return {
        shouldSend: false,
        reason: `Failure count (${failureCount}) is below error threshold (${settings.errorThreshold}).`,
      };
    }

    if (isCurrentlyDown) {
      // Already notified about this outage. Do not repeat!
      await prisma.notificationState.update({
        where: { key: stateKey },
        data: { failureCount },
      });
      return {
        shouldSend: false,
        reason: 'Repeated outage suppressed. Provider is already marked as DOWN.',
      };
    }

    // Transition to DOWN and notify once
    const downSince = Date.now();
    await prisma.notificationState.upsert({
      where: { key: stateKey },
      update: {
        state: 'DOWN',
        failureCount,
        lastNotifiedAt: new Date(),
        metadata: JSON.stringify({ downSince }),
      },
      create: {
        key: stateKey,
        state: 'DOWN',
        failureCount,
        lastNotifiedAt: new Date(),
        metadata: JSON.stringify({ downSince }),
      },
    });

    return { shouldSend: true };
  }

  if (event.type === 'PROVIDER_CONNECTION_RECOVERED') {
    const stateKey = `provider:${event.provider || 'cloudflare'}:connection`;
    const currentState = await prisma.notificationState.findUnique({
      where: { key: stateKey },
    });

    if (!currentState || currentState.state !== 'DOWN') {
      // Not currently recorded as DOWN, no recovery alert needed
      return {
        shouldSend: false,
        reason: 'Provider was not in an outage state. Recovery notification omitted.',
      };
    }

    let outageDurationSeconds: number | undefined;
    if (currentState.metadata) {
      try {
        const meta = JSON.parse(currentState.metadata);
        if (meta?.downSince) {
          outageDurationSeconds = Math.max(1, Math.round((Date.now() - meta.downSince) / 1000));
        }
      } catch {
        // ignore
      }
    }

    // Reset to HEALTHY
    await prisma.notificationState.update({
      where: { key: stateKey },
      data: {
        state: 'HEALTHY',
        failureCount: 0,
        lastNotifiedAt: new Date(),
        metadata: null,
      },
    });

    return { shouldSend: true, outageDurationSeconds };
  }

  // 5. General Event Cooldown & Deduplication
  const dedupKey = `event:${event.type}:${event.domain || event.jobId || 'global'}`;
  const cooldownWindowMs = settings.cooldownSeconds * 1000;
  const existingState = await prisma.notificationState.findUnique({
    where: { key: dedupKey },
  });

  if (existingState) {
    const timeSinceLast = Date.now() - new Date(existingState.lastNotifiedAt).getTime();
    if (timeSinceLast < cooldownWindowMs) {
      return {
        shouldSend: false,
        reason: `Suppressed by cooldown window (${Math.round((cooldownWindowMs - timeSinceLast) / 1000)}s remaining).`,
      };
    }
  }

  // Record / update state for cooldown tracking
  await prisma.notificationState.upsert({
    where: { key: dedupKey },
    update: {
      lastNotifiedAt: new Date(),
      state: 'SENT',
    },
    create: {
      key: dedupKey,
      state: 'SENT',
      lastNotifiedAt: new Date(),
    },
  });

  return { shouldSend: true };
}
