-- CreateTable
CREATE TABLE "NotificationSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'discord',
    "encryptedWebhookUrl" TEXT,
    "webhookIv" TEXT,
    "webhookTag" TEXT,
    "botName" TEXT NOT NULL DEFAULT 'PulseDNS',
    "avatarUrl" TEXT,
    "minSeverity" TEXT NOT NULL DEFAULT 'INFO',
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 60,
    "errorThreshold" INTEGER NOT NULL DEFAULT 1,
    "includeIpAddresses" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "periodicSummaryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "periodicSummarySchedule" TEXT NOT NULL DEFAULT 'daily',
    "lastSummaryAt" DATETIME,
    "notifyIpChange" BOOLEAN NOT NULL DEFAULT true,
    "notifyDnsSuccess" BOOLEAN NOT NULL DEFAULT true,
    "notifyDnsFailure" BOOLEAN NOT NULL DEFAULT true,
    "notifyConnectionLost" BOOLEAN NOT NULL DEFAULT true,
    "notifyConnectionRecovered" BOOLEAN NOT NULL DEFAULT true,
    "notifyJobStatus" BOOLEAN NOT NULL DEFAULT true,
    "notifyAgentStatus" BOOLEAN NOT NULL DEFAULT true,
    "notifySystemStartup" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "statusMessage" TEXT,
    "lastTestedAt" DATETIME,
    "lastDeliveredAt" DATETIME,
    "lastFailedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "domain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "responseCode" INTEGER,
    "sentAt" DATETIME,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationState" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL,
    "lastNotifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_idempotencyKey_key" ON "NotificationDelivery"("idempotencyKey");
