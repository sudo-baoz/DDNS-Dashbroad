import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { decryptText } from '@/lib/crypto';
import { getProviderAdapter } from '@/lib/providers/factory';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';

  const zones = await prisma.dnsZone.findMany({
    where: search
      ? {
          name: {
            contains: search,
          },
        }
      : undefined,
    include: {
      provider: {
        select: {
          id: true,
          name: true,
          provider: true,
          status: true,
        },
      },
      _count: {
        select: {
          records: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ zones });
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const providers = await prisma.providerIntegration.findMany({
      where: { status: 'CONNECTED' },
    });

    let totalSyncedZones = 0;
    let totalSyncedRecords = 0;

    for (const provider of providers) {
      try {
        const credentials = JSON.parse(
          decryptText(provider.encryptedCredentials, provider.iv, provider.tag)
        );
        const adapter = getProviderAdapter(provider.provider);
        const zones = await adapter.listZones(credentials);

        for (const z of zones) {
          const zoneRecord = await prisma.dnsZone.upsert({
            where: { id: `${provider.id}_${z.id}` },
            update: {
              name: z.name,
              status: z.status,
              paused: z.paused,
            },
            create: {
              id: `${provider.id}_${z.id}`,
              providerId: provider.id,
              zoneIdentifier: z.id,
              name: z.name,
              status: z.status,
              paused: z.paused,
            },
          });
          totalSyncedZones++;

          // Sync records for this zone
          const records = await adapter.listRecords(credentials, z.id);
          for (const r of records) {
            if (r.type === 'A' || r.type === 'AAAA') {
              await prisma.dnsRecord.upsert({
                where: { id: `${zoneRecord.id}_${r.id}` },
                update: {
                  name: r.name,
                  type: r.type,
                  content: r.content,
                  proxied: !!r.proxied,
                  ttl: r.ttl || 1,
                },
                create: {
                  id: `${zoneRecord.id}_${r.id}`,
                  providerId: provider.id,
                  zoneId: zoneRecord.id,
                  recordIdentifier: r.id,
                  name: r.name,
                  type: r.type,
                  content: r.content,
                  proxied: !!r.proxied,
                  ttl: r.ttl || 1,
                  isManaged: false,
                },
              });
              totalSyncedRecords++;
            }
          }
        }
      } catch (pErr: any) {
        console.warn(`Failed to sync provider ${provider.name}:`, pErr.message);
      }
    }

    await logAudit({
      action: 'ZONE_SYNC',
      severity: 'INFO',
      description: `Manual zone sync completed: ${totalSyncedZones} zones and ${totalSyncedRecords} records synchronized.`,
    });

    return NextResponse.json({
      success: true,
      message: `Synchronized ${totalSyncedZones} zones and ${totalSyncedRecords} records.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to sync zones.' },
      { status: 500 }
    );
  }
}
