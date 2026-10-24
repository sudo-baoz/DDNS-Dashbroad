import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../lib/auth';

describe('Auth & Password Security', () => {
  it('should securely hash password and verify matching password', async () => {
    const raw = 'SuperSecureP@ssw0rd123!';
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix

    const isMatch = await verifyPassword(raw, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPassword('WrongPassword!', hash);
    expect(isWrongMatch).toBe(false);
  });
});
