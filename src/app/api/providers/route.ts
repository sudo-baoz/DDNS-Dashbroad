import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAllProvidersMetadata } from '@/lib/providers/factory';

export async function GET(req: NextRequest) {

  const connectedProviders = await prisma.providerIntegration.findMany({
    select: {
      id: true,
      provider: true,
      name: true,
      status: true,
      statusMessage: true,
      lastVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          zones: true,
          records: true,
        },
      },
    },
  });

  const metadataList = getAllProvidersMetadata();

  return NextResponse.json({
    connectedProviders,
    catalog: metadataList,
  });
}
