import prisma from '../prisma';
import crypto from 'node:crypto';
import { DiscordWebhookPayload, NotificationEventType, NotificationSeverity } from './types';

export interface EnqueueOptions {
  eventType: NotificationEventType;
  severity: NotificationSeverity;
  title: string;
  description: string;
  domain?: string;
  payload: DiscordWebhookPayload;
  idempotencyKey?: string;
  maxAttempts?: number;
}

export function generateIdempotencyKey(
  eventType: string,
  targetId: string = 'global',
  windowMinutes: number = 5
): string {
  const windowBucket = Math.floor(Date.now() / (windowMinutes * 60 * 1000));
  const raw = `${eventType}:${targetId}:${windowBucket}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export async function enqueueNotification(options: EnqueueOptions) {
  const payloadJson = JSON.stringify(options.payload);
  const idempotencyKey =
    options.idempotencyKey ||
    generateIdempotencyKey(options.eventType, options.domain || 'global', 2);

  try {
    const existing = await prisma.notificationDelivery.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    return await prisma.notificationDelivery.create({
      data: {
        eventType: options.eventType,
        severity: options.severity,
        title: options.title,
        description: options.description,
        domain: options.domain || null,
        payloadJson,
        idempotencyKey,
        status: 'PENDING',
        attemptCount: 0,
        maxAttempts: options.maxAttempts || 5,
        nextAttemptAt: new Date(),
      },
    });
  } catch (err: any) {
    // If unique constraint violation race condition occurred, fetch the existing one
    if (err.code === 'P2002') {
      return await prisma.notificationDelivery.findUnique({
        where: { idempotencyKey },
      });
    }
    throw err;
  }
}

export async function getPendingDeliveries(limit: number = 5) {
  const now = new Date();
  return prisma.notificationDelivery.findMany({
    where: {
      status: { in: ['PENDING', 'RETRYING'] },
      nextAttemptAt: { lte: now },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

export async function markDeliverySending(id: string) {
  return prisma.notificationDelivery.update({
    where: { id },
    data: {
      status: 'SENDING',
      attemptCount: { increment: 1 },
      updatedAt: new Date(),
    },
  });
}

export async function markDeliverySuccess(id: string, responseCode: number = 204) {
  return prisma.notificationDelivery.update({
    where: { id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      responseCode,
      lastError: null,
      updatedAt: new Date(),
    },
  });
}

export async function markDeliveryRetry(
  id: string,
  error: string,
  retryAfterMs?: number,
  currentAttempts: number = 1,
  maxAttempts: number = 5
) {
  if (currentAttempts >= maxAttempts) {
    return prisma.notificationDelivery.update({
      where: { id },
      data: {
        status: 'FAILED',
        lastError: `Exceeded maximum attempts (${maxAttempts}). Last error: ${error}`,
        updatedAt: new Date(),
      },
    });
  }

  // Calculate exponential backoff with jitter
  let delayMs: number;
  if (retryAfterMs && retryAfterMs > 0) {
    delayMs = retryAfterMs;
  } else {
    const baseBackoffSec = Math.min(15 * Math.pow(2, Math.max(0, currentAttempts - 1)), 1800);
    const jitterSec = Math.floor(Math.random() * 5);
    delayMs = (baseBackoffSec + jitterSec) * 1000;
  }

  const nextAttemptAt = new Date(Date.now() + delayMs);

  return prisma.notificationDelivery.update({
    where: { id },
    data: {
      status: 'RETRYING',
      nextAttemptAt,
      lastError: error,
      updatedAt: new Date(),
    },
  });
}

export async function markDeliveryPermanentFailure(
  id: string,
  error: string,
  responseCode?: number
) {
  return prisma.notificationDelivery.update({
    where: { id },
    data: {
      status: 'FAILED',
      responseCode: responseCode || 400,
      lastError: error,
      updatedAt: new Date(),
    },
  });
}

export async function retryDeliveryById(id: string) {
  return prisma.notificationDelivery.update({
    where: { id },
    data: {
      status: 'PENDING',
      attemptCount: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    },
  });
}
