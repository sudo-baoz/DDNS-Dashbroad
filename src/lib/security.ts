import { NextRequest, NextResponse } from 'next/server';

/**
 * Homelab Security & Origin Protection Utility
 *
 * PulseDNS operates as an unauthenticated single-instance Homelab application.
 * To protect against Cross-Site Request Forgery (CSRF), DNS rebinding, and
 * malicious cross-origin drive-by requests from untrusted external websites:
 * 1. State-changing requests (POST, PATCH, DELETE, PUT) on dashboard endpoints
 *    must originate from the same host, private LAN, or configured trusted origins.
 * 2. Wildcard CORS is prohibited.
 * 3. Remote Agent update endpoints use bearer token authentication instead.
 */

const PRIVATE_IP_REGEXES = [
  /^localhost(:[0-9]+)?$/i,
  /^127\.0\.0\.1(:[0-9]+)?$/,
  /^::1(:[0-9]+)?$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:[0-9]+)?$/,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:[0-9]+)?$/,
  /^192\.168\.\d{1,3}\.\d{1,3}(:[0-9]+)?$/,
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\.\d{1,3}\.\d{1,3}(:[0-9]+)?$/, // Tailscale CGNAT
  /^[a-zA-Z0-9-]+\.local(:[0-9]+)?$/i,
  /^[a-zA-Z0-9-]+\.home\.arpa(:[0-9]+)?$/i,
];

function getHostFromUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.host; // includes port if present
  } catch {
    return '';
  }
}

/**
 * Determine if a given hostname / host header is from a trusted local or homelab source.
 */
export function isTrustedHost(host: string): boolean {
  if (!host) return false;

  const normalized = host.toLowerCase().trim();

  // Check against RFC1918, localhost, .local, and Tailscale
  if (PRIVATE_IP_REGEXES.some((regex) => regex.test(normalized))) {
    return true;
  }

  // Check against optional user-configured TRUSTED_HOSTS / TRUSTED_ORIGINS
  const envHosts = process.env.TRUSTED_HOSTS || process.env.TRUSTED_ORIGINS || '';
  if (envHosts) {
    const allowed = envHosts.split(',').map((h) => h.trim().toLowerCase());
    return allowed.some((allowedHost) => {
      if (allowedHost.startsWith('http://') || allowedHost.startsWith('https://')) {
        return getHostFromUrl(allowedHost) === normalized;
      }
      return allowedHost === normalized;
    });
  }

  return false;
}

/**
 * Validate that a state-changing browser request (POST/PATCH/DELETE)
 * originates from the trusted application host or trusted homelab origins.
 */
export function validateStateChangeOrigin(req: NextRequest): {
  allowed: boolean;
  errorResponse?: NextResponse;
} {
  // Safe read-only HTTP methods are permitted
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return { allowed: true };
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const secFetchSite = req.headers.get('sec-fetch-site');

  // Explicitly block cross-site browser requests
  if (secFetchSite === 'cross-site') {
    return {
      allowed: false,
      errorResponse: NextResponse.json(
        { error: 'Forbidden: Cross-site request rejected by Homelab security policy.' },
        { status: 403 }
      ),
    };
  }

  // Check Origin header if present
  if (origin) {
    const originHost = getHostFromUrl(origin);
    const matchesCurrentHost = originHost.toLowerCase() === host.toLowerCase();
    const isOriginTrusted = isTrustedHost(originHost);

    if (!matchesCurrentHost && !isOriginTrusted) {
      return {
        allowed: false,
        errorResponse: NextResponse.json(
          { error: `Forbidden: Untrusted origin "${origin}" for state-changing operation.` },
          { status: 403 }
        ),
      };
    }
    return { allowed: true };
  }

  // Check Referer header if present and no Origin
  if (referer) {
    const refererHost = getHostFromUrl(referer);
    const matchesCurrentHost = refererHost.toLowerCase() === host.toLowerCase();
    const isRefererTrusted = isTrustedHost(refererHost);

    if (!matchesCurrentHost && !isRefererTrusted) {
      return {
        allowed: false,
        errorResponse: NextResponse.json(
          { error: `Forbidden: Untrusted referer "${referer}" for state-changing operation.` },
          { status: 403 }
        ),
      };
    }
    return { allowed: true };
  }

  // If neither Origin nor Referer is provided (e.g. server curl, CLI automation)
  // verify that the Host itself is valid
  if (host && !isTrustedHost(host)) {
    // If external host header is present and not trusted
    const envHosts = process.env.TRUSTED_HOSTS || process.env.TRUSTED_ORIGINS || '';
    if (envHosts) {
      return {
        allowed: false,
        errorResponse: NextResponse.json(
          { error: `Forbidden: Request host "${host}" is not in TRUSTED_HOSTS.` },
          { status: 403 }
        ),
      };
    }
  }

  return { allowed: true };
}
