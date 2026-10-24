import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidIPv4,
  isValidIPv6,
  detectPublicIPv4,
  detectPublicIPv6,
} from '../lib/ip-detector';

describe('IP Detector & Validator', () => {
  describe('isValidIPv4', () => {
    it('should validate valid IPv4 addresses', () => {
      expect(isValidIPv4('192.168.1.1')).toBe(true);
      expect(isValidIPv4('8.8.8.8')).toBe(true);
      expect(isValidIPv4('104.21.45.12')).toBe(true);
      expect(isValidIPv4('255.255.255.255')).toBe(true);
      expect(isValidIPv4('0.0.0.0')).toBe(true);
    });

    it('should reject invalid IPv4 addresses', () => {
      expect(isValidIPv4('256.1.1.1')).toBe(false);
      expect(isValidIPv4('192.168.1')).toBe(false);
      expect(isValidIPv4('192.168.1.1.1')).toBe(false);
      expect(isValidIPv4('abc.def.ghi.jkl')).toBe(false);
      expect(isValidIPv4('')).toBe(false);
      expect(isValidIPv4('2001:db8::1')).toBe(false); // IPv6 in IPv4 validator
    });
  });

  describe('isValidIPv6', () => {
    it('should validate valid IPv6 addresses', () => {
      expect(isValidIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
      expect(isValidIPv6('2001:db8:85a3::8a2e:370:7334')).toBe(true);
      expect(isValidIPv6('::1')).toBe(true);
      expect(isValidIPv6('2606:4700:4700::1111')).toBe(true);
    });

    it('should reject invalid IPv6 addresses', () => {
      expect(isValidIPv6('192.168.1.1')).toBe(false);
      expect(isValidIPv6('2001:xyz::1')).toBe(false);
      expect(isValidIPv6('')).toBe(false);
      expect(isValidIPv6('2001:db8:::1')).toBe(false);
    });
  });

  describe('detectPublicIPv4 with fallback', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should return detected IP from first responsive mirror', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => '203.0.113.195\n',
      } as any);

      const res = await detectPublicIPv4(['https://api.ipify.org']);
      expect(res.ip).toBe('203.0.113.195');
      expect(res.serviceUsed).toBe('https://api.ipify.org');
    });

    it('should fallback to second service if first service fails', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          ok: true,
          text: async () => '198.51.100.42',
        } as any);

      const res = await detectPublicIPv4([
        'https://failing-service.com',
        'https://backup-service.com',
      ]);
      expect(res.ip).toBe('198.51.100.42');
      expect(res.serviceUsed).toBe('https://backup-service.com');
    });

    it('should handle complete failure of all mirrors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('All mirrors down'));

      const res = await detectPublicIPv4(['https://mirror1.com', 'https://mirror2.com']);
      expect(res.ip).toBeNull();
      expect(res.error).toBeDefined();
    });
  });
});
