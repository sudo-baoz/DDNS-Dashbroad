import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { CloudflareAdapter } from '@/lib/providers/cloudflare';
import { encryptText } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {

  try {
    const body = await req.json();
    const { apiToken, name = 'Cloudflare Account' } = body;

    if (!apiToken || typeof apiToken !== 'string' || apiToken.trim().length === 0) {
      return NextResponse.json(
        { error: 'Cloudflare API Token is required.' },
        { status: 400 }
      );
    }

    const adapter = new CloudflareAdapter();
    const testResult = await adapter.testConnection({ apiToken });

    if (!testResult.success) {
      return NextResponse.json(
        { error: testResult.message },
        { status: 400 }
      );
    }

    // Encrypt credentials at rest
    const { encrypted, iv, tag } = encryptText(JSON.stringify({ apiToken: apiToken.trim() }));

    // Find existing or create new
    let provider = await prisma.providerIntegration.findFirst({
      where: { provider: 'cloudflare' },
    });

    if (provider) {
      provider = await prisma.providerIntegration.update({
        where: { id: provider.id },
        data: {
          name: name.trim(),
          encryptedCredentials: encrypted,
          iv,
          tag,
          status: 'CONNECTED',
          statusMessage: testResult.message,
          lastVerifiedAt: new Date(),
        },
      });
    } else {
      provider = await prisma.providerIntegration.create({
        data: {
          provider: 'cloudflare',
          name: name.trim(),
          encryptedCredentials: encrypted,
          iv,
          tag,
          status: 'CONNECTED',
          statusMessage: testResult.message,
          lastVerifiedAt: new Date(),
        },
      });
    }

    // Automatically sync zones and DNS records
    const zones = await adapter.listZones({ apiToken: apiToken.trim() });
    let totalRecordsSynced = 0;

    for (const z of zones) {
      const zoneRecord = await prisma.dnsZone.upsert({
        where: {
          id: `${provider.id}_${z.id}`,
        },
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

      // Fetch records for this zone
      try {
        const records = await adapter.listRecords({ apiToken: apiToken.trim() }, z.id);
        for (const r of records) {
          // Only sync A and AAAA records for DDNS management
          if (r.type === 'A' || r.type === 'AAAA') {
            await prisma.dnsRecord.upsert({
              where: {
                id: `${zoneRecord.id}_${r.id}`,
              },
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
            totalRecordsSynced++;
          }
        }
      } catch (recErr) {
        console.warn(`Could not sync records for zone ${z.name}:`, recErr);
      }
    }

    await logAudit({
      action: 'PROVIDER_CONNECT',
      severity: 'SUCCESS',
      description: `Successfully connected Cloudflare account with ${zones.length} zones and ${totalRecordsSynced} records.`,
      metadata: {
        providerId: provider.id,
        zoneCount: zones.length,
        recordCount: totalRecordsSynced,
      },
    });

    return NextResponse.json({
      success: true,
      message: testResult.message,
      provider: {
        id: provider.id,
        name: provider.name,
        provider: provider.provider,
        status: provider.status,
        lastVerifiedAt: provider.lastVerifiedAt,
      },
      zoneCount: zones.length,
      recordCount: totalRecordsSynced,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to verify Cloudflare token.' },
      { status: 500 }
    );
  }
}
