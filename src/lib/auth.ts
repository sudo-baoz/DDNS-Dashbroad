import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import prisma from './prisma';
import { generateRandomToken } from './crypto';

export const SESSION_COOKIE_NAME = 'pulsedns_session';
const SESSION_DURATION_DAYS = 7;

/**
 * Hash a password using bcrypt with high work factor.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

/**
 * Verify a password against a hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a new user session in the database.
 */
export async function createSession(userId: string) {
  const token = generateRandomToken(48);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return session;
}

/**
 * Validate a session token from cookie/database.
 */
export async function getSessionUser(token?: string) {
  if (!token) {
    const cookieStore = cookies();
    token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  }

  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session) return null;

  // Check expiration
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
}

/**
 * Middleware check for API routes. Returns response if unauthenticated.
 */
export async function requireAuth(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return { user: null, errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const user = await getSessionUser(token);
  if (!user) {
    return { user: null, errorResponse: NextResponse.json({ error: 'Session expired or invalid' }, { status: 401 }) };
  }

  return { user, errorResponse: null };
}

/**
 * Revoke a session token.
 */
export async function revokeSession(token: string) {
  try {
    await prisma.session.delete({
      where: { token },
    });
  } catch {
    // Already deleted or invalid
  }
}

/**
 * Check if the application has completed initial setup (i.e. at least one user exists).
 */
export async function hasAdminUser(): Promise<boolean> {
  const count = await prisma.user.count();
  return count > 0;
}
