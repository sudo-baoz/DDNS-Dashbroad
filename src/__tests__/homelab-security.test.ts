import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { isTrustedHost, validateStateChangeOrigin } from '../lib/security';
import { hashToken, generateRandomToken, encryptText, decryptText } from '../lib/crypto';

describe('Homelab Security & Origin Protection', () => {
  describe('isTrustedHost', () => {
    it('should trust localhost and 127.0.0.1', () => {
      expect(isTrustedHost('localhost')).toBe(true);
      expect(isTrustedHost('localhost:3000')).toBe(true);
      expect(isTrustedHost('127.0.0.1')).toBe(true);
      expect(isTrustedHost('127.0.0.1:3000')).toBe(true);
    });

    it('should trust standard RFC 1918 private LAN IP ranges', () => {
      expect(isTrustedHost('192.168.1.100')).toBe(true);
      expect(isTrustedHost('192.168.1.100:3000')).toBe(true);
      expect(isTrustedHost('10.0.0.50')).toBe(true);
      expect(isTrustedHost('172.16.0.10')).toBe(true);
      expect(isTrustedHost('172.31.255.255:8080')).toBe(true);
    });

    it('should trust Tailscale CGNAT IP ranges and local mDNS hostnames', () => {
      expect(isTrustedHost('100.85.12.34')).toBe(true);
      expect(isTrustedHost('homelab-nas.local')).toBe(true);
      expect(isTrustedHost('pulsedns.home.arpa')).toBe(true);
    });

    it('should reject untrusted external public hostnames', () => {
      expect(isTrustedHost('attacker.com')).toBe(false);
      expect(isTrustedHost('evil-site.org:443')).toBe(false);
      expect(isTrustedHost('8.8.8.8')).toBe(false);
    });
  });

  describe('validateStateChangeOrigin (CSRF & DNS Rebinding Prevention)', () => {
    it('should allow GET requests unconditionally', () => {
      const req = new NextRequest('http://localhost:3000/api/dashboard/stats', {
        method: 'GET',
      });
      const result = validateStateChangeOrigin(req);
      expect(result.allowed).toBe(true);
    });

    it('should block cross-site Sec-Fetch-Site requests', () => {
      const req = new NextRequest('http://localhost:3000/api/jobs', {
        method: 'POST',
        headers: {
          'sec-fetch-site': 'cross-site',
          origin: 'https://malicious-website.com',
          host: 'localhost:3000',
        },
      });
      const result = validateStateChangeOrigin(req);
      expect(result.allowed).toBe(false);
      expect(result.errorResponse?.status).toBe(403);
    });

    it('should reject state-changing POST from untrusted origin', () => {
      const req = new NextRequest('http://192.168.1.50:3000/api/jobs', {
        method: 'POST',
        headers: {
          origin: 'https://evil-phishing.com',
          host: '192.168.1.50:3000',
        },
      });
      const result = validateStateChangeOrigin(req);
      expect(result.allowed).toBe(false);
      expect(result.errorResponse?.status).toBe(403);
    });

    it('should allow state-changing POST from same host or trusted LAN origin', () => {
      const req = new NextRequest('http://192.168.1.50:3000/api/jobs', {
        method: 'POST',
        headers: {
          origin: 'http://192.168.1.50:3000',
          host: '192.168.1.50:3000',
        },
      });
      const result = validateStateChangeOrigin(req);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Remote Agent Credentials & Encryption at Rest', () => {
    it('should securely hash remote agent tokens with SHA-256', () => {
      const rawToken = `pulse_${generateRandomToken(32)}`;
      const hash1 = hashToken(rawToken);
      const hash2 = hashToken(rawToken);

      expect(hash1).toHaveLength(64); // SHA-256 hex string
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(rawToken);
    });

    it('should encrypt and decrypt provider tokens without plaintext leakage', () => {
      const secretToken = 'cloudflare_api_token_very_secret_xyz123';
      const encryptedData = encryptText(secretToken);

      expect(encryptedData.encrypted).not.toContain(secretToken);
      expect(encryptedData.iv).toHaveLength(32);
      expect(encryptedData.tag).toHaveLength(32);

      const decrypted = decryptText(
        encryptedData.encrypted,
        encryptedData.iv,
        encryptedData.tag
      );
      expect(decrypted).toBe(secretToken);
    });
  });
});
