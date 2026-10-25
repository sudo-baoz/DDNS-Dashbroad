/**
 * PulseDNS Production Database Migration Runner
 * Handles safe schema migrations, legacy table archival, and baselining.
 */
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function migrate() {
  const dbUrl = process.env.DATABASE_URL || 'file:./prisma/pulsedns.db';
  let effectiveDbUrl = dbUrl;
  console.log(`>>> [PulseDNS Migration] Starting migration for datasource: ${dbUrl}`);

  // SQLite-specific safety checks and baselining
  if (dbUrl.startsWith('file:')) {
    const rawPath = dbUrl.replace(/^file:/, '');
    let resolvedPath = path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(process.cwd(), rawPath.startsWith('./') ? rawPath.slice(2) : rawPath);

    // For relative paths only: if file doesn't exist at resolvedPath, check if it exists in prisma/ folder
    if (!path.isAbsolute(rawPath) && !fs.existsSync(resolvedPath)) {
      const altPath = path.resolve(process.cwd(), 'prisma', path.basename(rawPath));
      if (fs.existsSync(altPath)) {
        resolvedPath = altPath;
      }
    }

    effectiveDbUrl = `file:${resolvedPath}`;

    const dbDir = path.dirname(resolvedPath);
    if (!fs.existsSync(dbDir)) {
      console.log(`>>> [PulseDNS Migration] Creating database directory: ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
    }

    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).size > 0) {
      console.log(`>>> [PulseDNS Migration] Checking existing database file: ${resolvedPath}`);
      const prisma = new PrismaClient({
        datasources: { db: { url: `file:${resolvedPath}` } },
      });

      try {
        const tablesResult = await prisma.$queryRawUnsafe(
          "SELECT name FROM sqlite_master WHERE type='table'"
        );
        const tableNames = new Set(tablesResult.map((t) => t.name));

        // 1. Safely archive legacy User and Session tables if they exist
        if (tableNames.has('User')) {
          console.log('>>> [PulseDNS Migration] Archiving legacy "User" table to "_legacy_User"...');
          await prisma.$executeRawUnsafe(
            'CREATE TABLE IF NOT EXISTS "_legacy_User" AS SELECT * FROM "User"'
          );
        }
        if (tableNames.has('Session')) {
          console.log('>>> [PulseDNS Migration] Archiving legacy "Session" table to "_legacy_Session"...');
          await prisma.$executeRawUnsafe(
            'CREATE TABLE IF NOT EXISTS "_legacy_Session" AS SELECT * FROM "Session"'
          );
        }

        // 2. Baseline initial migration if database was previously managed via db push
        if (!tableNames.has('_prisma_migrations') && tableNames.has('ProviderIntegration')) {
          console.log('>>> [PulseDNS Migration] Existing unmigrated database detected. Baselining initial migration...');
          execSync('npx prisma migrate resolve --applied 20261025000000_init', {
            stdio: 'inherit',
            env: { ...process.env, DATABASE_URL: `file:${resolvedPath}` },
          });
        }
      } catch (checkErr) {
        console.warn('>>> [PulseDNS Migration] Pre-migration check warning:', checkErr.message);
      } finally {
        await prisma.$disconnect();
      }
    }
  }

  // If invoked with 'status', check migration status and exit
  if (process.argv.includes('status')) {
    console.log('>>> [PulseDNS Migration] Checking migration status with prisma migrate status...');
    execSync('npx prisma migrate status', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: effectiveDbUrl },
    });
    console.log('>>> [PulseDNS Migration] Migration status check completed.');
    return;
  }

  // Execute standard Prisma migrate deploy with resolved URL
  console.log('>>> [PulseDNS Migration] Applying pending migrations with prisma migrate deploy...');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: effectiveDbUrl },
  });

  console.log('>>> [PulseDNS Migration] All migrations applied successfully.');
}

migrate().catch((err) => {
  console.error('>>> [PulseDNS Migration] Fatal migration error:', err);
  process.exit(1);
});
