import net from 'node:net';

// Strict IPv4 validation regex
const IPV4_REGEX = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

// Strict IPv6 validation regex (standard + compressed)
const IPV6_REGEX =
  /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9]))$/;

export const DEFAULT_IPV4_SERVICES = [
  'https://api.ipify.org',
  'https://icanhazip.com',
  'https://ifconfig.me/ip',
  'https://checkip.amazonaws.com',
];

export const DEFAULT_IPV6_SERVICES = [
  'https://api6.ipify.org',
  'https://ipv6.icanhazip.com',
];

/**
 * Validate if a string is a valid public IPv4 address.
 */
export function isValidIPv4(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  if (net.isIPv4(trimmed) && IPV4_REGEX.test(trimmed)) {
    // Avoid private/loopback if needed, or allow all valid IPv4
    return true;
  }
  return false;
}

/**
 * Validate if a string is a valid IPv6 address.
 */
export function isValidIPv6(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  if (net.isIPv6(trimmed) && IPV6_REGEX.test(trimmed)) {
    return true;
  }
  return false;
}

export interface IPDetectionResult {
  ip: string | null;
  serviceUsed: string | null;
  error?: string;
  latencyMs: number;
}

/**
 * Fetch text from an endpoint with strict timeout.
 */
async function fetchWithTimeout(url: string, timeoutMs: number = 5000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'PulseDNS-DDNS-Engine/1.0',
        Accept: 'text/plain',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Detect public IPv4 using fallback services.
 */
export async function detectPublicIPv4(services: string[] = DEFAULT_IPV4_SERVICES, timeoutMs = 5000): Promise<IPDetectionResult> {
  const start = Date.now();
  let lastError = 'No IPv4 detection services responded';

  for (const service of services) {
    try {
      const response = await fetchWithTimeout(service.trim(), timeoutMs);
      if (isValidIPv4(response)) {
        return {
          ip: response,
          serviceUsed: service.trim(),
          latencyMs: Date.now() - start,
        };
      } else {
        lastError = `Service ${service} returned invalid IPv4: "${response.substring(0, 50)}"`;
      }
    } catch (err: any) {
      lastError = `Failed ${service}: ${err.message}`;
    }
  }

  return {
    ip: null,
    serviceUsed: null,
    error: lastError,
    latencyMs: Date.now() - start,
  };
}

/**
 * Detect public IPv6 using fallback services.
 * Note: If the host has no IPv6 connectivity, this will safely return null without throwing.
 */
export async function detectPublicIPv6(services: string[] = DEFAULT_IPV6_SERVICES, timeoutMs = 4000): Promise<IPDetectionResult> {
  const start = Date.now();
  let lastError = 'No IPv6 detection services responded (host may lack IPv6 connectivity)';

  for (const service of services) {
    try {
      const response = await fetchWithTimeout(service.trim(), timeoutMs);
      if (isValidIPv6(response)) {
        return {
          ip: response,
          serviceUsed: service.trim(),
          latencyMs: Date.now() - start,
        };
      } else {
        lastError = `Service ${service} returned invalid IPv6: "${response.substring(0, 50)}"`;
      }
    } catch (err: any) {
      lastError = `Failed ${service}: ${err.message}`;
    }
  }

  return {
    ip: null,
    serviceUsed: null,
    error: lastError,
    latencyMs: Date.now() - start,
  };
}
