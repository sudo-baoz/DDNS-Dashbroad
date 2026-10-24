import prisma from './prisma';
import { runDueDDNSJobs } from './ddns-engine';

let schedulerInterval: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
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
 * Start the background DDNS scheduler.
 */
export function startDDNSScheduler() {
  if (isRunning) return;
  isRunning = true;

  console.log('[PulseDNS] Starting background DDNS scheduler worker...');

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

  const cleanup = () => {
    console.log('[PulseDNS] Gracefully stopping background worker...');
    if (schedulerInterval) clearInterval(schedulerInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
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
  isRunning = false;
}

export function isSchedulerRunning(): boolean {
  return isRunning;
}
