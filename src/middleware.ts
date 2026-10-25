import { NextRequest, NextResponse } from 'next/server';
import { validateStateChangeOrigin } from './lib/security';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Backward-compatibility redirects: /login and /setup redirect to root dashboard
  if (pathname === '/login' || pathname === '/setup') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url, 307);
  }

  // 2. Validate Origin & CSRF for state-changing API requests (excluding remote agent reporting)
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/agent/update')) {
    const check = validateStateChangeOrigin(req);
    if (!check.allowed && check.errorResponse) {
      return check.errorResponse;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
