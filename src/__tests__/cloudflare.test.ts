import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudflareAdapter } from '../lib/providers/cloudflare';

describe('Cloudflare DNS Provider Adapter', () => {
  let adapter: CloudflareAdapter;

  beforeEach(() => {
    adapter = new CloudflareAdapter();
    vi.restoreAllMocks();
  });

  it('should declare correct capabilities', () => {
    const caps = adapter.getCapabilities();
    expect(caps.supportsIPv4).toBe(true);
    expect(caps.supportsIPv6).toBe(true);
    expect(caps.supportsProxied).toBe(true);
    expect(caps.supportsTTL).toBe(true);
    expect(caps.supportsZoneListing).toBe(true);
  });

  it('should verify active token successfully', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: { id: 'token_123', status: 'active' },
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: [
            { id: 'zone_abc', name: 'example.com', status: 'active', paused: false },
          ],
        }),
      } as any);

    const testRes = await adapter.testConnection({ apiToken: 'valid_test_token' });
    expect(testRes.success).toBe(true);
    expect(testRes.details?.zoneCount).toBe(1);
    expect(testRes.message).toContain('Successfully authenticated');
  });

  it('should reject inactive or invalid tokens', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        errors: [],
        messages: [],
        result: { id: 'token_123', status: 'expired' },
      }),
    } as any);

    const testRes = await adapter.testConnection({ apiToken: 'expired_token' });
    expect(testRes.success).toBe(false);
    expect(testRes.message).toContain('status is "expired"');
  });

  it('should handle Cloudflare API rate limit errors (HTTP 429)', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        success: false,
        errors: [{ code: 10013, message: 'Rate limit exceeded' }],
        messages: [],
        result: null,
      }),
    } as any);

    await expect(adapter.listZones({ apiToken: 'my_token' })).rejects.toThrow(
      'Rate limit exceeded'
    );
  });

  it('should update record using PATCH and preserve options', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        errors: [],
        messages: [],
        result: {
          id: 'rec_456',
          zone_id: 'zone_123',
          name: 'vpn.example.com',
          type: 'A',
          content: '203.0.113.99',
          proxied: true,
          ttl: 1,
        },
      }),
    } as any);

    const updated = await adapter.updateRecord(
      { apiToken: 'token' },
      'zone_123',
      'rec_456',
      {
        content: '203.0.113.99',
        proxied: true,
      }
    );

    expect(updated.content).toBe('203.0.113.99');
    expect(updated.proxied).toBe(true);

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    expect(fetchCall[1]?.method).toBe('PATCH');
    const sentBody = JSON.parse(fetchCall[1]?.body as string);
    expect(sentBody.content).toBe('203.0.113.99');
    expect(sentBody.proxied).toBe(true);
  });
});
