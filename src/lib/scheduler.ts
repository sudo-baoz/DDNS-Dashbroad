import prisma from './prisma';
import { runDueDDNSJobs } from './ddns-engine';
import {
  startNotificationWorker,
  stopNotificationWorker,
  notificationService,
} from './notifications';

let schedulerInterval: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let digestInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Update worker heartbeat in database so dashboard UI displays live worker status.
 */
async function updateHeartbeat() {
  try {
    await prisma.applicationSettings.upsert({
      where: { id: 'default' },
      update: { workerHeartbeat: new Date() },
      create: { id: 'default', workerHeartbeat: new Date() },
    });
  } catch (err) {
    // Database might be initializing or busy
  }
}

/**
 * Dispatch system startup notification once, with cooldown protection against crash loops.
 */
async function sendStartupNotificationSafe() {
  try {
    const startupStateKey = 'system:startup:last_notified';
    const existing = await prisma.notificationState.findUnique({
      where: { key: startupStateKey },
    });

    const now = Date.now();
    // 15-minute cooldown to prevent crash-loop spam
    if (existing && now - new Date(existing.lastNotifiedAt).getTime() < 15 * 60 * 1000) {
      return;
    }

    await prisma.notificationState.upsert({
      where: { key: startupStateKey },
      update: { lastNotifiedAt: new Date(), state: 'STARTED' },
      create: { key: startupStateKey, lastNotifiedAt: new Date(), state: 'STARTED' },
    });

    await notificationService.dispatch({
      type: 'SYSTEM_STARTUP',
      severity: 'INFO',
      title: '🚀 PulseDNS Services Started',
      description: 'PulseDNS background monitoring and DDNS scheduler are now running.',
    });
  } catch (err) {
    console.error('[PulseDNS] Error sending startup notification:', err);
  }
}

/**
 * Check if periodic summary digest should be generated.
 */
async function checkPeriodicDigest() {
  try {
    const settings = await prisma.notificationSetting.findUnique({
      where: { id: 'default' },
    });

    if (!settings || !settings.enabled || !settings.periodicSummaryEnabled) {
      return;
    }

    const intervalMs = settings.periodicSummarySchedule === 'weekly'
      ? 7 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

    const lastRun = settings.lastSummaryAt ? new Date(settings.lastSummaryAt).getTime() : 0;
    if (Date.now() - lastRun >= intervalMs) {
      await notificationService.generatePeriodicDigest();
    }
  } catch (err) {
    console.error('[PulseDNS] Error checking periodic digest:', err);
  }
}

/**
 * Start the background DDNS scheduler and notification worker.
 */
export function startDDNSScheduler() {
  if (isRunning) return;
  isRunning = true;

  console.log('[PulseDNS] Starting background DDNS scheduler and notification workers...');

  // Start notification outbox worker
  startNotificationWorker(5000);

  // Send startup notification
  sendStartupNotificationSafe();

  // Immediate heartbeat
  updateHeartbeat();

  // Heartbeat every 15 seconds
  heartbeatInterval = setInterval(updateHeartbeat, 15000);

  // Check and run due jobs every 10 seconds
  schedulerInterval = setInterval(async () => {
    try {
      await runDueDDNSJobs();
    } catch (err) {
      console.error('[PulseDNS] Error in DDNS worker loop:', err);
    }
  }, 10000);

  // Check periodic digest every 15 minutes
  digestInterval = setInterval(checkPeriodicDigest, 15 * 60 * 1000);

  const cleanup = () => {
    console.log('[PulseDNS] Gracefully stopping background workers...');
    if (schedulerInterval) clearInterval(schedulerInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (digestInterval) clearInterval(digestInterval);
    stopNotificationWorker();
    isRunning = false;
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

/**
 * Stop background scheduler.
 */
export function stopDDNSScheduler() {
  if (schedulerInterval) clearInterval(schedulerInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (digestInterval) clearInterval(digestInterval);
  stopNotificationWorker();
  isRunning = false;
}

export function isSchedulerRunning(): boolean {
  return isRunning;
}
