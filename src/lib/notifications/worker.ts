import prisma from '../prisma';
import { discordClient } from './discord-client';
import {
  getPendingDeliveries,
  markDeliverySending,
  markDeliverySuccess,
  markDeliveryRetry,
  markDeliveryPermanentFailure,
} from './queue';
import { notificationService } from './service';
import { sanitizeLogMessage } from './ssrf';

let workerInterval: NodeJS.Timeout | null = null;
let isWorkerRunning = false;
let isProcessingBatch = false;

/**
 * Process a single batch of pending notifications from the persistent outbox queue.
 */
export async function processNotificationQueueBatch(): Promise<number> {
  if (isProcessingBatch) return 0;
  isProcessingBatch = true;

  try {
    const pending = await getPendingDeliveries(5);
    if (pending.length === 0) {
      return 0;
    }

    const { decryptedWebhookUrl, settings } = await notificationService.getSettings();

    if (!decryptedWebhookUrl || !settings.enabled) {
      // Cannot deliver without configured active webhook
      return 0;
    }

    let processedCount = 0;

    for (const item of pending) {
      try {
        await markDeliverySending(item.id);

        let payload;
        try {
          payload = JSON.parse(item.payloadJson);
        } catch {
          await markDeliveryPermanentFailure(item.id, 'Malformed payload JSON.');
          continue;
        }

        const result = await discordClient.send(decryptedWebhookUrl, payload, {
          wait: false,
          timeoutMs: 8000,
        });

        if (result.success) {
          await markDeliverySuccess(item.id, result.statusCode || 204);
          await prisma.notificationSetting.update({
            where: { id: 'default' },
            data: {
              lastDeliveredAt: new Date(),
              status: 'CONNECTED',
            },
          });
          processedCount++;
        } else if (result.statusCode === 429) {
          // Rate limited: pause and schedule retry
          await markDeliveryRetry(
            item.id,
            result.error || 'Discord rate limit',
            result.retryAfterMs,
            item.attemptCount + 1,
            item.maxAttempts
          );

          await prisma.notificationSetting.update({
            where: { id: 'default' },
            data: {
              status: 'RATE_LIMITED',
              statusMessage: sanitizeLogMessage(result.error || 'Rate limited'),
            },
          });

          // Break loop on 429 to respect backoff
          break;
        } else if (result.isPermanentFailure) {
          await markDeliveryPermanentFailure(item.id, result.error || 'Permanent failure', result.statusCode);

          if (result.statusCode === 401 || result.statusCode === 403 || result.statusCode === 404) {
            await prisma.notificationSetting.update({
              where: { id: 'default' },
              data: {
                status: 'INVALID_WEBHOOK',
                statusMessage: sanitizeLogMessage(result.error || 'Invalid webhook token'),
              },
            });
          }
        } else {
          // Temporary failure: exponential backoff retry
          await markDeliveryRetry(
            item.id,
            result.error || 'Temporary delivery error',
            undefined,
            item.attemptCount + 1,
            item.maxAttempts
          );

          await prisma.notificationSetting.update({
            where: { id: 'default' },
            data: {
              lastFailedAt: new Date(),
              status: 'DELIVERY_FAILED',
              statusMessage: sanitizeLogMessage(result.error || 'Delivery failed'),
            },
          });
        }
      } catch (itemErr: any) {
        console.error(`[NotificationWorker] Unexpected error delivering notification ${item.id}:`, itemErr);
        await markDeliveryRetry(
          item.id,
          sanitizeLogMessage(itemErr.message || 'Worker runtime error'),
          undefined,
          item.attemptCount + 1,
          item.maxAttempts
        );
      }
    }

    return processedCount;
  } catch (batchErr) {
    console.error('[NotificationWorker] Queue batch error:', batchErr);
    return 0;
  } finally {
    isProcessingBatch = false;
  }
}

/**
 * Start the background notification queue worker.
 */
export function startNotificationWorker(intervalMs: number = 5000) {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  console.log('[PulseDNS] Notification queue delivery worker started.');

  // Run immediate first check
  processNotificationQueueBatch().catch(() => {});

  // Poll queue every intervalMs (default 5s)
  workerInterval = setInterval(async () => {
    try {
      await processNotificationQueueBatch();
    } catch (err) {
      console.error('[NotificationWorker] Polling loop exception:', err);
    }
  }, intervalMs);

  const cleanup = () => {
    if (workerInterval) clearInterval(workerInterval);
    isWorkerRunning = false;
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

/**
 * Stop background worker.
 */
export function stopNotificationWorker() {
  if (workerInterval) clearInterval(workerInterval);
  isWorkerRunning = false;
}
