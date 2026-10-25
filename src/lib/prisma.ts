import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith('file:')) return url;

  const rawPath = url.replace(/^file:/, '');
  if (path.isAbsolute(rawPath)) return url;

  let resolved = path.resolve(process.cwd(), rawPath.startsWith('./') ? rawPath.slice(2) : rawPath);

  // If not found at direct path, check if it exists in prisma/ subdirectory
  if (!fs.existsSync(resolved)) {
    const alt = path.resolve(process.cwd(), 'prisma', path.basename(rawPath));
    if (fs.existsSync(alt)) {
      resolved = alt;
    }
  }

  return `file:${resolved}`;
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const datasourceUrl = getDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
