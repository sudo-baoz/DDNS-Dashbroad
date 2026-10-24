import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, createSession, SESSION_COOKIE_NAME, hasAdminUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET() {
  const isSetup = await hasAdminUser();
  return NextResponse.json({ isSetup });
}

export async function POST(req: NextRequest) {
  try {
    const isSetup = await hasAdminUser();
    if (isSetup) {
      return NextResponse.json(
        { error: 'Initial administrator account already exists. Use the login screen.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { username, password } = body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters long.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        passwordHash,
      },
    });

    // Create session
    const session = await createSession(user.id);

    // Initial application settings
    await prisma.applicationSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });

    await logAudit({
      action: 'AUTH_SETUP',
      severity: 'SUCCESS',
      description: `Administrator account "${user.username}" created during initial setup.`,
      metadata: { username: user.username },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
      },
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: session.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to complete initial setup.' },
      { status: 500 }
    );
  }
}
