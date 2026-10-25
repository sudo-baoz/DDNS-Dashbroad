import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decryptText } from '@/lib/crypto';
import { getProviderAdapter } from '@/lib/providers/factory';
import { logAudit } from '@/lib/audit';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {

  const provider = await prisma.providerIntegration.findUnique({
    where: { id: params.id },
  });

  if (!provider) {
    return NextResponse.json({ error: 'Provider integration not found.' }, { status: 404 });
  }

  await prisma.providerIntegration.delete({
    where: { id: params.id },
  });

  await logAudit({
    action: 'PROVIDER_DISCONNECT',
    severity: 'INFO',
    description: `Disconnected provider "${provider.name}" (${provider.provider}).`,
    metadata: { providerId: params.id },
  });

  return NextResponse.json({ success: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {

  const provider = await prisma.providerIntegration.findUnique({
    where: { id: params.id },
  });

  if (!provider) {
    return NextResponse.json({ error: 'Provider integration not found.' }, { status: 404 });
  }

  try {
    const credentials = JSON.parse(
      decryptText(provider.encryptedCredentials, provider.iv, provider.tag)
    );
    const adapter = getProviderAdapter(provider.provider);
    const result = await adapter.testConnection(credentials);

    await prisma.providerIntegration.update({
      where: { id: provider.id },
      data: {
        status: result.success ? 'CONNECTED' : 'ERROR',
        statusMessage: result.message,
        lastVerifiedAt: new Date(),
      },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Connection test failed.' },
      { status: 500 }
    );
  }
}
