import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
export async function GET(req: NextRequest) {

  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';
  const action = url.searchParams.get('action');
  const severity = url.searchParams.get('severity');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(5, parseInt(url.searchParams.get('limit') || '25', 10)));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.description = { contains: search };
  }
  if (action && action !== 'ALL') {
    where.action = action;
  }
  if (severity && severity !== 'ALL') {
    where.severity = severity.toUpperCase();
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
