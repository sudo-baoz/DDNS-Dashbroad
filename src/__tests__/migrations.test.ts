import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

describe('PulseDNS Database Migration & Data Preservation', () => {
  const testDir = path.resolve(process.cwd(), 'scratch', 'vitest-migrations');
  const backupDbPath = path.resolve(process.cwd(), 'backups', 'pulsedns_pre_migration.db');

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('safely upgrades an existing database containing legacy User and Session data without data loss', async () => {
    const upgradedDbFile = path.join(testDir, 'upgraded.db');
    if (fs.existsSync(backupDbPath)) {
      fs.copyFileSync(backupDbPath, upgradedDbFile);
    } else {
      // Create representative pre-migration database with User, Session, Provider, and RemoteAgent
      const tempPrisma = new PrismaClient({
        datasources: { db: { url: `file:${upgradedDbFile}` } },
      });
      await tempPrisma.$executeRawUnsafe(`
        CREATE TABLE "User" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "username" TEXT NOT NULL,
          "passwordHash" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        );
      `);
      await tempPrisma.$executeRawUnsafe(`
        CREATE TABLE "Session" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "token" TEXT NOT NULL,
          "expiresAt" DATETIME NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await tempPrisma.$executeRawUnsafe(`
        CREATE TABLE "ProviderIntegration" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "provider" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "encryptedCredentials" TEXT NOT NULL,
          "iv" TEXT NOT NULL,
          "tag" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'CONNECTED',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        );
      `);
      await tempPrisma.$executeRawUnsafe(`
        CREATE TABLE "RemoteAgent" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "tokenHash" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        );
      `);
      await tempPrisma.$executeRawUnsafe(`
        INSERT INTO "User" ("id", "username", "passwordHash", "updatedAt") VALUES ('u1', 'admin', 'hash123', CURRENT_TIMESTAMP);
      `);
      await tempPrisma.$executeRawUnsafe(`
        INSERT INTO "Session" ("id", "userId", "token", "expiresAt") VALUES ('s1', 'u1', 'token123', CURRENT_TIMESTAMP);
      `);
      await tempPrisma.$executeRawUnsafe(`
        INSERT INTO "RemoteAgent" ("id", "name", "tokenHash", "updatedAt") VALUES ('a1', 'agent-1', 'hash_a1', CURRENT_TIMESTAMP);
      `);
      await tempPrisma.$disconnect();
    }

    // Verify pre-conditions
    const prePrisma = new PrismaClient({
      datasources: { db: { url: `file:${upgradedDbFile}` } },
    });
    const preUsers: any[] = await prePrisma.$queryRawUnsafe('SELECT count(*) as count FROM User');
    const preSessions: any[] = await prePrisma.$queryRawUnsafe('SELECT count(*) as count FROM Session');
    const preAgents: any[] = await prePrisma.$queryRawUnsafe('SELECT count(*) as count FROM RemoteAgent');
    await prePrisma.$disconnect();

    expect(Number(preUsers[0].count)).toBeGreaterThan(0);
    expect(Number(preSessions[0].count)).toBeGreaterThan(0);
    const originalAgentCount = Number(preAgents[0].count);

    // Run migration script
    execSync(`node scripts/migrate.js`, {
      env: { ...process.env, DATABASE_URL: `file:${upgradedDbFile}` },
      stdio: 'pipe',
    });

    // Verify post-conditions
    const postPrisma = new PrismaClient({
      datasources: { db: { url: `file:${upgradedDbFile}` } },
    });

    // Tables in sqlite_master
    const tables: any[] = await postPrisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const tableNames = new Set(tables.map((t) => t.name));

    // Active auth tables must be absent from active schema
    expect(tableNames.has('User')).toBe(false);
    expect(tableNames.has('Session')).toBe(false);

    // Legacy tables must be archived and non-empty
    expect(tableNames.has('_legacy_User')).toBe(true);
    expect(tableNames.has('_legacy_Session')).toBe(true);

    const legacyUsers: any[] = await postPrisma.$queryRawUnsafe('SELECT count(*) as count FROM _legacy_User');
    const legacySessions: any[] = await postPrisma.$queryRawUnsafe('SELECT count(*) as count FROM _legacy_Session');
    const postAgents: any[] = await postPrisma.$queryRawUnsafe('SELECT count(*) as count FROM RemoteAgent');

    expect(Number(legacyUsers[0].count)).toBe(Number(preUsers[0].count));
    expect(Number(legacySessions[0].count)).toBe(Number(preSessions[0].count));
    expect(Number(postAgents[0].count)).toBe(originalAgentCount);

    // Migration history must be initialized
    expect(tableNames.has('_prisma_migrations')).toBe(true);
    const migrations: any[] = await postPrisma.$queryRawUnsafe(
      'SELECT migration_name FROM _prisma_migrations'
    );
    expect(migrations.length).toBe(2);

    await postPrisma.$disconnect();

    // Idempotency check: Re-running migration must succeed without error
    expect(() => {
      execSync(`node scripts/migrate.js`, {
        env: { ...process.env, DATABASE_URL: `file:${upgradedDbFile}` },
        stdio: 'pipe',
      });
    }).not.toThrow();
  });

  it('initializes a fresh database from scratch with complete active Homelab schema', async () => {
    const freshDbFile = path.join(testDir, 'fresh.db');
    if (fs.existsSync(freshDbFile)) fs.unlinkSync(freshDbFile);

    // Run migration script on fresh DB
    execSync(`node scripts/migrate.js`, {
      env: { ...process.env, DATABASE_URL: `file:${freshDbFile}` },
      stdio: 'pipe',
    });

    const freshPrisma = new PrismaClient({
      datasources: { db: { url: `file:${freshDbFile}` } },
    });

    const tables: any[] = await freshPrisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const tableNames = new Set(tables.map((t) => t.name));

    // Must have all business tables
    expect(tableNames.has('ProviderIntegration')).toBe(true);
    expect(tableNames.has('DnsZone')).toBe(true);
    expect(tableNames.has('DnsRecord')).toBe(true);
    expect(tableNames.has('RemoteAgent')).toBe(true);
    expect(tableNames.has('DdnsJob')).toBe(true);
    expect(tableNames.has('DdnsExecution')).toBe(true);
    expect(tableNames.has('IpHistory')).toBe(true);
    expect(tableNames.has('AuditLog')).toBe(true);
    expect(tableNames.has('ApplicationSettings')).toBe(true);
    expect(tableNames.has('_prisma_migrations')).toBe(true);

    // Auth tables must not exist
    expect(tableNames.has('User')).toBe(false);
    expect(tableNames.has('Session')).toBe(false);

    await freshPrisma.$disconnect();

    // Idempotency check
    expect(() => {
      execSync(`node scripts/migrate.js`, {
        env: { ...process.env, DATABASE_URL: `file:${freshDbFile}` },
        stdio: 'pipe',
      });
    }).not.toThrow();
  });
});
