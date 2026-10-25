# PulseDNS — Security Policy & Controls

This document details the security architecture, encryption standards, authentication models, and data protection mechanisms enforced throughout PulseDNS.

---

## 1. Homelab Security Model & Design Principles

PulseDNS is intentionally designed as a **single-instance, trusted-network Homelab dashboard**. It eliminates user logins and session management to provide immediate, friction-free access within private networks while strictly enforcing defense-in-depth:

- **Network Access Boundary**: The dashboard is intended for private LANs (RFC 1918), VPN meshes (Tailscale / WireGuard), or behind an authenticated reverse proxy (e.g. Traefik, Caddy, Authelia, Cloudflare Access). It must not be exposed directly to the public internet without network-level access controls.
- **Origin & CSRF Defense**: Next.js middleware and API route guards validate `Origin` and `Referer` headers on all state-changing requests (`POST`, `PATCH`, `DELETE`, `PUT`). Requests originating from untrusted foreign websites (e.g. drive-by CSRF or DNS rebinding) are rejected with `403 Forbidden`.
- **Zero Client Token Exposure**: Plaintext provider credentials (such as Cloudflare API tokens) are never transmitted to browser clients after initial verification.
- **Encrypted Credentials at Rest**: All API tokens and provider credentials stored in SQLite are encrypted using **AES-256-GCM**.
- **Remote Agent Authentication**: Remote clients reporting IP changes are cryptographically authenticated via unique, revocable SHA-256 hashed bearer tokens. Unauthenticated push endpoints do not exist.

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

For distributed deployments where remote home servers or routers report dynamic public IPs:
- Each agent receives a unique random bearer token prefixed with `pulse_` (`pulse_` + 64 hex characters).
- The raw token is displayed **only once** to the user upon creation.
- The server stores only the **SHA-256 hash** of the token in `RemoteAgent.tokenHash`.
- When reporting to `/api/agent/update`, incoming tokens are hashed on-the-fly and compared against the database.
- Tokens can be instantly revoked from the Settings dashboard.

---

## 4. Audit Logging & Secret Masking

PulseDNS logs system events (provider connections, record modifications, DDNS triggers, agent tokens) into the `AuditLog` table.
Before any metadata object is serialized into JSON:
- Recursive sanitization scans key names for sensitive patterns (`token`, `password`, `secret`, `key`, `credentials`, `authorization`, `bearer`).
- Matching fields are replaced with `[REDACTED]`.
- Stack traces and internal error messages are sanitized before client exposure.

---

## 5. Security Headers

Every HTTP response includes hardening headers:
- `X-Frame-Options: DENY` (clickjacking defense)
- `X-Content-Type-Options: nosniff` (MIME sniffing defense)
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 6. Reporting Security Vulnerabilities

If you discover a security issue or vulnerability in PulseDNS, please submit a report through GitHub Security Advisories or contact the repository maintainers directly.
