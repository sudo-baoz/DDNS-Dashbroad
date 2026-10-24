import { describe, it, expect } from 'vitest';
import { encryptText, decryptText, hashToken, generateRandomToken } from '../lib/crypto';

describe('Crypto & Encryption System', () => {
  it('should encrypt and decrypt plaintext using AES-256-GCM correctly', () => {
    const secret = JSON.stringify({ apiToken: 'cf_sample_token_secret_12345' });
    const encryptedData = encryptText(secret);

    expect(encryptedData.encrypted).toBeDefined();
    expect(encryptedData.iv).toHaveLength(32); // 16 bytes in hex
    expect(encryptedData.tag).toHaveLength(32); // 16 bytes auth tag in hex

    const decrypted = decryptText(
      encryptedData.encrypted,
      encryptedData.iv,
      encryptedData.tag
    );
    expect(decrypted).toBe(secret);
  });

  it('should fail decryption when ciphertext is tampered with', () => {
    const secret = 'super-secret-credentials';
    const encryptedData = encryptText(secret);

    // Tamper with first byte of ciphertext
    const tampered =
      (encryptedData.encrypted[0] === 'a' ? 'b' : 'a') +
      encryptedData.encrypted.slice(1);

    expect(() => {
      decryptText(tampered, encryptedData.iv, encryptedData.tag);
    }).toThrow();
  });

  it('should consistently hash tokens using SHA-256', () => {
    const token = 'pulse_token_sample_12345';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // 32 bytes in hex
  });

  it('should generate cryptographically random tokens', () => {
    const t1 = generateRandomToken(32);
    const t2 = generateRandomToken(32);

    expect(t1).not.toBe(t2);
    expect(t1).toHaveLength(64);
  });
});
