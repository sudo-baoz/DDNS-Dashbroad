import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateDiscordWebhookUrl,
  maskWebhookUrl,
  sanitizeLogMessage,
} from '../lib/notifications/ssrf';
import {
  buildDiscordEmbed,
  buildWebhookPayload,
  buildTestWebhookPayload,
  formatIp,
  DISCORD_COLORS,
} from '../lib/notifications/embed-builder';
import {
  isWithinQuietHours,
  evaluateAntiSpam,
} from '../lib/notifications/anti-spam';
import { DiscordWebhookClient } from '../lib/notifications/discord-client';
import { generateIdempotencyKey } from '../lib/notifications/queue';
import { encryptText, decryptText } from '../lib/crypto';
import prisma from '../lib/prisma';

describe('Notifications Subsystem: Webhook URL Validation & SSRF Defense', () => {
  it('accepts valid official Discord webhook URLs across supported subdomains', () => {
    const validUrls = [
      'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789-_ABCDEFGHIJKLMNOPQRST',
      'https://discordapp.com/api/webhooks/987654321098765432/token_sample_1234567890abcdefghijklmnopqrstuvwxyz',
      'https://canary.discord.com/api/webhooks/111222333444555666/canary_token_sample_abcdef1234567890-_XYZ',
      'https://ptb.discord.com/api/webhooks/999888777666555444/ptb_token_sample_abcdef1234567890-_XYZ',
    ];

    for (const url of validUrls) {
      const res = validateDiscordWebhookUrl(url);
      expect(res.valid).toBe(true);
      expect(res.sanitizedUrl).toBeDefined();
      expect(res.webhookId).toBeDefined();
    }
  });

  it('rejects unencrypted HTTP protocol', () => {
    const res = validateDiscordWebhookUrl(
      'http://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789'
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('HTTPS');
  });

  it('blocks non-Discord hostnames and SSRF vectors', () => {
    const maliciousUrls = [
      'https://attacker.com/api/webhooks/123456789012345678/token12345678901234567890123456789012',
      'https://localhost/api/webhooks/123456789012345678/token12345678901234567890123456789012',
      'https://127.0.0.1/api/webhooks/123456789012345678/token12345678901234567890123456789012',
      'https://169.254.169.254/api/webhooks/123456789012345678/token12345678901234567890123456789012',
      'https://internal.lan/api/webhooks/123456789012345678/token12345678901234567890123456789012',
      'https://discord.com.attacker.com/api/webhooks/123456789012345678/token12345678901234567890123456789012',
    ];

    for (const url of maliciousUrls) {
      const res = validateDiscordWebhookUrl(url);
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/authorized Discord endpoint|Invalid/);
    }
  });

  it('rejects URLs with embedded credentials and custom ports', () => {
    const credentialUrl =
      'https://user:pass@discord.com/api/webhooks/123456789012345678/token12345678901234567890123456789012';
    expect(validateDiscordWebhookUrl(credentialUrl).valid).toBe(false);

    const portUrl =
      'https://discord.com:8443/api/webhooks/123456789012345678/token12345678901234567890123456789012';
    expect(validateDiscordWebhookUrl(portUrl).valid).toBe(false);
  });

  it('masks sensitive webhook tokens in UI and logs', () => {
    const url =
      'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789';
    const masked = maskWebhookUrl(url);

    expect(masked).toContain('123456789012345678');
    expect(masked).not.toContain('abcdefghijklmnopqrstuvwxyz0123456789');
    expect(masked).toContain('•••');
  });

  it('sanitizes error logs to ensure no webhook tokens leak into audit logs', () => {
    const rawError =
      'Delivery failed to https://discord.com/api/webhooks/123456789012345678/secret_token_12345678901234567890 with HTTP 500';
    const sanitized = sanitizeLogMessage(rawError);

    expect(sanitized).not.toContain('secret_token_12345678901234567890');
    expect(sanitized).toContain('[REDACTED]');
  });
});

describe('Notifications Subsystem: Credential Encryption at Rest', () => {
  it('encrypts and decrypts webhook URLs securely with AES-256-GCM', () => {
    const originalUrl =
      'https://discord.com/api/webhooks/123456789012345678/super_secret_token_abcdef1234567890';
    const encrypted = encryptText(originalUrl);

    expect(encrypted.encrypted).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();
    expect(encrypted.encrypted).not.toContain('super_secret_token');

    const decrypted = decryptText(encrypted.encrypted, encrypted.iv, encrypted.tag);
    expect(decrypted).toBe(originalUrl);
  });
});

describe('Notifications Subsystem: Discord Rich Embed Generation', () => {
  it('generates properly formatted embeds with required colors and allowed_mentions: []', () => {
    const payload = buildWebhookPayload(
      [
        buildDiscordEmbed({
          type: 'PUBLIC_IP_CHANGED',
          severity: 'INFO',
          title: '🌐 Public IP Changed',
          description: 'A monitored public IP address has changed.',
          domain: 'home.example.com',
          recordType: 'A',
          previousIp: '203.0.113.10',
          newIp: '203.0.113.20',
          detectionSource: 'SERVER_IP',
        }),
      ],
      { botName: 'PulseDNS Test' }
    );

    expect(payload.username).toBe('PulseDNS Test');
    expect(payload.allowed_mentions).toEqual({ parse: [] });
    expect(payload.embeds).toHaveLength(1);

    const embed = payload.embeds[0];
    expect(embed.title).toContain('Public IP Changed');
    expect(embed.color).toBe(DISCORD_COLORS.BLUE);
    expect(embed.footer?.text).toContain('PulseDNS');
    expect(embed.timestamp).toBeDefined();

    const fieldNames = embed.fields?.map((f) => f.name);
    expect(fieldNames).toContain('Previous IP');
    expect(fieldNames).toContain('New IP');
  });

  it('correctly masks IP addresses when includeIpAddresses is false', () => {
    expect(formatIp('203.0.113.25', true)).toBe('203.0.113.25');
    expect(formatIp('203.0.113.25', false)).toBe('203.0.***.***');
    expect(formatIp('2001:db8:85a3::8a2e:370:7334', false)).toBe('2001:db8:****::****');
  });

  it('builds valid test webhook embed message', () => {
    const testPayload = buildTestWebhookPayload({ botName: 'PulseDNS', timezone: 'UTC' });
    expect(testPayload.embeds[0].title).toContain('PulseDNS Webhook Connected');
    expect(testPayload.embeds[0].color).toBe(DISCORD_COLORS.GREEN);
    expect(testPayload.embeds[0].footer?.text).toBe('PulseDNS • Notification Test');
  });
});

describe('Notifications Subsystem: Anti-Spam, Cooldown & Outage State Machine', () => {
  const baseSettings = {
    enabled: true,
    minSeverity: 'INFO',
    cooldownSeconds: 60,
    errorThreshold: 2,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    timezone: 'Asia/Ho_Chi_Minh',
    notifyIpChange: true,
    notifyDnsSuccess: true,
    notifyDnsFailure: true,
    notifyConnectionLost: true,
    notifyConnectionRecovered: true,
    notifyJobStatus: true,
    notifyAgentStatus: true,
    notifySystemStartup: false,
  };

  beforeEach(async () => {
    await prisma.notificationState.deleteMany({
      where: {
        key: {
          contains: 'test-',
        },
      },
    });
  });

  it('suppresses notifications when integration is disabled', async () => {
    const decision = await evaluateAntiSpam(
      {
        type: 'DNS_UPDATE_SUCCESS',
        severity: 'SUCCESS',
        title: 'Success',
        description: 'Test',
      },
      { ...baseSettings, enabled: false }
    );
    expect(decision.shouldSend).toBe(false);
  });

  it('suppresses notifications below minimum severity threshold', async () => {
    const decision = await evaluateAntiSpam(
      {
        type: 'PUBLIC_IP_CHANGED',
        severity: 'INFO',
        title: 'IP Changed',
        description: 'Test',
      },
      { ...baseSettings, minSeverity: 'ERROR' }
    );
    expect(decision.shouldSend).toBe(false);
    expect(decision.reason).toContain('below minimum threshold');
  });

  it('suppresses transient outages below failure threshold', async () => {
    // Failure 1: below threshold 2
    const firstDecision = await evaluateAntiSpam(
      {
        type: 'PROVIDER_CONNECTION_LOST',
        severity: 'ERROR',
        title: 'Connection Lost',
        description: 'Test Outage',
        provider: 'test-transient-provider',
      },
      { ...baseSettings, errorThreshold: 2 }
    );
    expect(firstDecision.shouldSend).toBe(false);
    expect(firstDecision.reason).toContain('below error threshold');
  });

  it('sends outage alert once when threshold reached, and suppresses repeated duplicate outages', async () => {
    const providerKey = 'test-persistent-outage';

    // Reach threshold (first failure)
    await evaluateAntiSpam(
      {
        type: 'PROVIDER_CONNECTION_LOST',
        severity: 'ERROR',
        title: 'Connection Lost',
        description: 'Test Outage',
        provider: providerKey,
      },
      { ...baseSettings, errorThreshold: 2 }
    );

    // Second failure: reaches threshold 2 -> send alert!
    const secondDecision = await evaluateAntiSpam(
      {
        type: 'PROVIDER_CONNECTION_LOST',
        severity: 'ERROR',
        title: 'Connection Lost',
        description: 'Test Outage',
        provider: providerKey,
      },
      { ...baseSettings, errorThreshold: 2 }
    );
    expect(secondDecision.shouldSend).toBe(true);

    // Third failure: already DOWN -> do not spam duplicate!
    const thirdDecision = await evaluateAntiSpam(
      {
        type: 'PROVIDER_CONNECTION_LOST',
        severity: 'ERROR',
        title: 'Connection Lost',
        description: 'Test Outage',
        provider: providerKey,
      },
      { ...baseSettings, errorThreshold: 2 }
    );
    expect(thirdDecision.shouldSend).toBe(false);
    expect(thirdDecision.reason).toContain('Repeated outage suppressed');

    // Recovery event: provider recovers -> sends recovery notification with duration!
    const recoveryDecision = await evaluateAntiSpam(
      {
        type: 'PROVIDER_CONNECTION_RECOVERED',
        severity: 'SUCCESS',
        title: 'Recovered',
        description: 'Connection restored',
        provider: providerKey,
      },
      baseSettings
    );
    expect(recoveryDecision.shouldSend).toBe(true);
    expect(recoveryDecision.outageDurationSeconds).toBeGreaterThanOrEqual(0);

    // Second recovery event: already healthy -> suppress
    const duplicateRecovery = await evaluateAntiSpam(
      {
        type: 'PROVIDER_CONNECTION_RECOVERED',
        severity: 'SUCCESS',
        title: 'Recovered',
        description: 'Connection restored',
        provider: providerKey,
      },
      baseSettings
    );
    expect(duplicateRecovery.shouldSend).toBe(false);
  });
});

describe('Notifications Subsystem: Discord Webhook Client & Rate Limit Handling', () => {
  const client = new DiscordWebhookClient();
  const validWebhookUrl =
    'https://discord.com/api/webhooks/123456789012345678/token12345678901234567890123456789012';

  it('handles HTTP 204 No Content success correctly', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204 })
    );

    const res = await client.send(
      validWebhookUrl,
      { allowed_mentions: { parse: [] }, embeds: [] },
      { wait: false }
    );

    expect(res.success).toBe(true);
    expect(res.statusCode).toBe(204);
    fetchMock.mockRestore();
  });

  it('handles HTTP 429 Rate Limiting and parses Retry-After header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ retry_after: 2.5, message: 'You are being rate limited.' }), {
        status: 429,
        headers: { 'retry-after': '2.5' },
      })
    );

    const res = await client.send(
      validWebhookUrl,
      { allowed_mentions: { parse: [] }, embeds: [] }
    );

    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.retryAfterMs).toBe(2500);
    expect(res.isPermanentFailure).toBe(false);
    fetchMock.mockRestore();
  });

  it('flags HTTP 401/404 as permanent failure to halt blind retry loops', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unknown Webhook' }), { status: 404 })
    );

    const res = await client.send(
      validWebhookUrl,
      { allowed_mentions: { parse: [] }, embeds: [] }
    );

    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(404);
    expect(res.isPermanentFailure).toBe(true);
    fetchMock.mockRestore();
  });
});

describe('Notifications Subsystem: Queue Persistence & Idempotency', () => {
  it('generates consistent idempotency keys within the same time bucket', () => {
    const key1 = generateIdempotencyKey('DNS_UPDATE_SUCCESS', 'home.example.com', 5);
    const key2 = generateIdempotencyKey('DNS_UPDATE_SUCCESS', 'home.example.com', 5);
    const diffKey = generateIdempotencyKey('DNS_UPDATE_SUCCESS', 'other.example.com', 5);

    expect(key1).toBe(key2);
    expect(key1).not.toBe(diffKey);
  });
});
