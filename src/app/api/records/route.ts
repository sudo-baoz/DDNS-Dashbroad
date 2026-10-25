import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decryptText } from '@/lib/crypto';
import { getProviderAdapter } from '@/lib/providers/factory';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {

  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';
  const zoneId = url.searchParams.get('zoneId');
  const type = url.searchParams.get('type');
  const isManagedParam = url.searchParams.get('isManaged');

  const where: any = {};
  if (search) {
    where.name = { contains: search };
  }
  if (zoneId) {
    where.zoneId = zoneId;
  }
  if (type) {
    where.type = type.toUpperCase();
  }
  if (isManagedParam !== null && isManagedParam !== undefined) {
    where.isManaged = isManagedParam === 'true';
  }

  const records = await prisma.dnsRecord.findMany({
    where,
    include: {
      zone: {
        select: {
          id: true,
          name: true,
          zoneIdentifier: true,
        },
      },
      provider: {
        select: {
          id: true,
          name: true,
          provider: true,
          status: true,
        },
      },
      jobs: {
        select: {
          id: true,
          name: true,
          enabled: true,
          status: true,
          intervalSeconds: true,
          lastExecutionAt: true,
          nextExecutionAt: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {

  try {
    const body = await req.json();
    const { zoneId, name, type, content, proxied = false, ttl = 1, isManaged = true } = body;

    if (!zoneId || !name || !type || !content) {
      return NextResponse.json(
        { error: 'Zone, record name, type (A or AAAA), and target IP content are required.' },
        { status: 400 }
      );
    }

    const zone = await prisma.dnsZone.findUnique({
      where: { id: zoneId },
      include: { provider: true },
    });

    if (!zone) {
      return NextResponse.json({ error: 'DNS Zone not found.' }, { status: 404 });
    }

    const credentials = JSON.parse(
      decryptText(zone.provider.encryptedCredentials, zone.provider.iv, zone.provider.tag)
    );
    const adapter = getProviderAdapter(zone.provider.provider);

    // Create record on Cloudflare
    const createdRecord = await adapter.createRecord(credentials, zone.zoneIdentifier, {
      name: name.trim(),
      type: type.toUpperCase() as 'A' | 'AAAA',
      content: content.trim(),
      proxied,
      ttl,
    });

    // Save to database
    const record = await prisma.dnsRecord.create({
      data: {
        id: `${zone.id}_${createdRecord.id}`,
        providerId: zone.provider.id,
        zoneId: zone.id,
        recordIdentifier: createdRecord.id,
        name: createdRecord.name,
        type: createdRecord.type,
        content: createdRecord.content,
        proxied: !!createdRecord.proxied,
        ttl: createdRecord.ttl || 1,
        isManaged,
        lastDetectedIp: content.trim(),
      },
      include: {
        zone: true,
        provider: true,
      },
    });

    await logAudit({
      action: 'RECORD_CREATE',
      severity: 'SUCCESS',
      description: `Created DNS record "${record.name}" (${record.type}) -> ${record.content} on Cloudflare.`,
      metadata: { recordId: record.id, name: record.name, type: record.type },
    });

    return NextResponse.json({ success: true, record });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to create DNS record.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {

  try {
    const body = await req.json();
    const { id, isManaged, proxied, ttl, content } = body;

    if (!id) {
      return NextResponse.json({ error: 'Record ID is required.' }, { status: 400 });
    }

    const record = await prisma.dnsRecord.findUnique({
      where: { id },
      include: { zone: true, provider: true },
    });

    if (!record) {
      return NextResponse.json({ error: 'DNS record not found.' }, { status: 404 });
    }

    const updateData: any = {};
    if (typeof isManaged === 'boolean') updateData.isManaged = isManaged;
    if (typeof proxied === 'boolean') updateData.proxied = proxied;
    if (typeof ttl === 'number') updateData.ttl = ttl;
    if (content) updateData.content = content.trim();

    // If updating remote DNS properties (content, proxied, ttl), sync with Cloudflare
    if (content || typeof proxied === 'boolean' || typeof ttl === 'number') {
      const credentials = JSON.parse(
        decryptText(record.provider.encryptedCredentials, record.provider.iv, record.provider.tag)
      );
      const adapter = getProviderAdapter(record.provider.provider);

      await adapter.updateRecord(
        credentials,
        record.zone.zoneIdentifier,
        record.recordIdentifier,
        {
          content: content || record.content,
          proxied: proxied !== undefined ? proxied : record.proxied,
          ttl: ttl !== undefined ? ttl : record.ttl,
        }
      );
    }

    const updated = await prisma.dnsRecord.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      action: 'RECORD_UPDATE',
      severity: 'INFO',
      description: `Updated record "${record.name}" settings (managed: ${updated.isManaged}).`,
      metadata: { recordId: id },
    });

    return NextResponse.json({ success: true, record: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update DNS record.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const deleteFromProvider = url.searchParams.get('deleteFromProvider') === 'true';

    if (!id) {
      return NextResponse.json({ error: 'Record ID required.' }, { status: 400 });
    }

    const record = await prisma.dnsRecord.findUnique({
      where: { id },
      include: { zone: true, provider: true },
    });

    if (!record) {
      return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    }

    if (deleteFromProvider) {
      const credentials = JSON.parse(
        decryptText(record.provider.encryptedCredentials, record.provider.iv, record.provider.tag)
      );
      const adapter = getProviderAdapter(record.provider.provider);
      if (adapter.deleteRecord) {
        await adapter.deleteRecord(credentials, record.zone.zoneIdentifier, record.recordIdentifier);
      }
    }

    // Delete record from database
    await prisma.dnsRecord.delete({
      where: { id },
    });

    await logAudit({
      action: 'RECORD_UPDATE',
      severity: 'INFO',
      description: `Removed record "${record.name}" from PulseDNS management${deleteFromProvider ? ' and deleted from Cloudflare' : ''}.`,
      metadata: { recordId: id, name: record.name, deleteFromProvider },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to delete record.' },
      { status: 500 }
    );
  }
}
