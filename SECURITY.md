# PulseDNS — Security Policy & Controls

This document details the security architecture, encryption standards, authentication models, and data protection mechanisms enforced throughout PulseDNS.

---

## 1. Threat Model & Design Principles

PulseDNS handles sensitive DNS management credentials capable of redirecting domain traffic. As such, security is treated as a foundational requirement:

- **Zero Client Token Exposure**: Plaintext provider credentials (such as Cloudflare API tokens) are never sent to the browser after the initial verification handshake.
- **No Public Registration**: Self-registration is strictly disabled. The initial master administrator is created once via `/setup`, and subsequent access is protected by authenticated sessions.
- **Encrypted Credentials at Rest**: All API tokens and provider credentials stored in the database are encrypted using **AES-256-GCM**.
- **No Sensitive Tokens in LocalStorage**: Session tokens are transmitted solely via `HTTP-only`, `SameSite=Lax`, and `Secure` cookies.

---

## 2. Encryption at Rest (AES-256-GCM)

Provider secrets are encrypted prior to database insertion:

```
Plaintext Token + Master Key (ENCRYPTION_KEY) + 128-bit Random IV
                    │
                    ▼
           AES-256-GCM Cipher
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
Ciphertext     128-bit IV      128-bit Tag
```

- **Algorithm**: `aes-256-gcm`
- **Key Derivation**: If a 64-character hex string is supplied in `ENCRYPTION_KEY`, it is loaded directly as a 256-bit key. Otherwise, SHA-256 key derivation is enforced.
- **Tampering Detection**: The Galois Counter Mode Authentication Tag (`tag`) guarantees integrity. Any alteration to the ciphertext or IV causes decryption to abort.

---

## 3. Remote Agent Authentication & Hashing

For distributed deployments where remote home servers report public IPs:
- Each agent receives a unique random bearer token prefixed with `pulse_` (`pulse_` + 64 hex characters).
- The raw token is displayed **only once** to the user upon creation.
- The server stores only the **SHA-256 hash** of the token in `RemoteAgent.tokenHash`.
- When reporting to `/api/agent/update`, incoming tokens are hashed on-the-fly and compared against the database.
- Tokens can be instantly revoked from the Settings dashboard.

---

## 4. Audit Logging & Secret Masking

PulseDNS logs security events (logins, password alterations, record modifications, DDNS triggers) into the `AuditLog` table.
Before any metadata object is serialized into JSON:
- Recursive sanitization scans key names for sensitive patterns (`token`, `password`, `secret`, `key`, `credentials`, `authorization`, `bearer`).
- Matching fields are replaced with `[REDACTED]`.
- Stack traces and error messages are sanitized before client exposure.

---

## 5. Security Headers

In `next.config.js`, enterprise security headers are enforced across all routes:

```javascript
[
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
]
```

---

## 6. Vulnerability Reporting

If you discover a potential vulnerability within PulseDNS, please submit a responsible disclosure report directly to the repository maintainer rather than opening a public issue.
