-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProviderIntegration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedCredentials" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "statusMessage" TEXT,
    "lastVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DnsZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "zoneIdentifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DnsZone_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderIntegration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DnsRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "recordIdentifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "proxied" BOOLEAN NOT NULL DEFAULT false,
    "ttl" INTEGER NOT NULL DEFAULT 1,
    "isManaged" BOOLEAN NOT NULL DEFAULT false,
    "lastDetectedIp" TEXT,
    "lastUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DnsRecord_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderIntegration" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DnsRecord_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DnsZone" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RemoteAgent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastReportedIp" TEXT,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DdnsJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "ipVersion" TEXT NOT NULL DEFAULT 'IPv4',
    "sourceMode" TEXT NOT NULL DEFAULT 'SERVER_IP',
    "remoteAgentId" TEXT,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 300,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "lastExecutionAt" DATETIME,
    "nextExecutionAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DdnsJob_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "DnsRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DdnsJob_remoteAgentId_fkey" FOREIGN KEY ("remoteAgentId") REFERENCES "RemoteAgent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DdnsExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "detectedIp" TEXT NOT NULL,
    "previousIp" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DdnsExecution_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DdnsJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IpHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "oldIp" TEXT,
    "newIp" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IpHistory_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "DnsRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ApplicationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "dashboardName" TEXT NOT NULL DEFAULT 'PulseDNS',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultTheme" TEXT NOT NULL DEFAULT 'dark',
    "defaultInterval" INTEGER NOT NULL DEFAULT 300,
    "ipv4SourceUrls" TEXT NOT NULL DEFAULT 'https://api.ipify.org,https://icanhazip.com,https://ifconfig.me/ip',
    "ipv6SourceUrls" TEXT NOT NULL DEFAULT 'https://api6.ipify.org,https://ipv6.icanhazip.com',
    "requestTimeoutSec" INTEGER NOT NULL DEFAULT 10,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "workerHeartbeat" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteAgent_tokenHash_key" ON "RemoteAgent"("tokenHash");

