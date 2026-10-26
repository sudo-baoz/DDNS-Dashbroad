import { URL } from 'node:url';

const ALLOWED_DISCORD_HOSTS = new Set([
  'discord.com',
  'discordapp.com',
  'canary.discord.com',
  'ptb.discord.com',
]);

const WEBHOOK_PATH_REGEX = /^\/api\/webhooks\/(\d{16,21})\/([A-Za-z0-9_-]{32,100})$/;

export interface WebhookValidationResult {
  valid: boolean;
  reason?: string;
  sanitizedUrl?: string;
  webhookId?: string;
}

/**
 * Validates a Discord Webhook URL with strict SSRF defense.
 * - Enforces HTTPS
 * - Whitelists only official Discord webhook hostnames
 * - Enforces exact /api/webhooks/{id}/{token} path schema
 * - Blocks loopback, private networks, credentials in authority, non-standard ports
 */
export function validateDiscordWebhookUrl(rawUrl: string): WebhookValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'Webhook URL cannot be empty.' };
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Invalid URL format.' };
  }

  // 1. Enforce HTTPS
  if (parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Webhook URL must use secure HTTPS protocol.' };
  }

  // 2. Disallow credentials in authority (e.g. user:pass@)
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'URL userinfo credentials are not permitted.' };
  }

  // 3. Disallow custom ports
  if (parsed.port && parsed.port !== '443') {
    return { valid: false, reason: 'Only default HTTPS port (443) is permitted.' };
  }

  // 4. Verify approved hostname
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_DISCORD_HOSTS.has(host)) {
    return {
      valid: false,
      reason: `Hostname "${host}" is not an authorized Discord endpoint. Allowed hosts: ${Array.from(ALLOWED_DISCORD_HOSTS).join(', ')}.`,
    };
  }

  // 5. Verify webhook path structure: /api/webhooks/{webhook_id}/{webhook_token}
  const match = parsed.pathname.match(WEBHOOK_PATH_REGEX);
  if (!match) {
    return {
      valid: false,
      reason: 'URL path must match the standard Discord webhook format: /api/webhooks/{id}/{token}.',
    };
  }

  const webhookId = match[1];
  const webhookToken = match[2];

  // Reconstruct clean URL without any unwanted extra paths or dangerous fragments
  const sanitizedUrl = `https://${host}/api/webhooks/${webhookId}/${webhookToken}`;

  return {
    valid: true,
    sanitizedUrl,
    webhookId,
  };
}

/**
 * Masks a webhook URL for secure UI display and logging.
 * Hides the webhook token while preserving the id and host.
 * Example: https://discord.com/api/webhooks/123456789012345678/••••••••••••••••••••••••••••••••••••••••
 */
export function maskWebhookUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl) return '';

  try {
    const parsed = new URL(rawUrl.trim());
    const match = parsed.pathname.match(/^\/api\/webhooks\/(\d{16,21})\/([A-Za-z0-9_-]+)$/);
    if (match) {
      const id = match[1];
      const token = match[2];
      const maskedToken = '•'.repeat(Math.min(token.length, 32));
      return `https://${parsed.hostname}/api/webhooks/${id}/${maskedToken}`;
    }
  } catch {
    // ignore
  }

  return 'https://discord.com/api/webhooks/••••••••••••';
}

/**
 * Sanitizes an error message or log string by redacting any Discord webhook URLs or tokens.
 */
export function sanitizeLogMessage(message: string): string {
  if (!message) return '';
  return message.replace(
    /https:\/\/(?:[a-zA-Z0-9.-]+)?discord(?:app)?\.com\/api\/webhooks\/(\d{16,21})\/([A-Za-z0-9_-]+)/g,
    'https://discord.com/api/webhooks/$1/[REDACTED]'
  );
}
