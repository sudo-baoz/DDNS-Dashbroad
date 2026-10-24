# PulseDNS — Testing & Verification Strategy

This document describes the automated testing suites, testing principles, mock provider structures, and execution instructions for PulseDNS.

---

## 1. Test Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │          PulseDNS Test Suite           │
                      └────────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌───────────────────────┐                         ┌───────────────────────┐
│ Unit / Integration    │                         │ End-to-End (E2E)      │
│ Framework: Vitest     │                         │ Framework: Playwright │
└───────────────────────┘                         └───────────────────────┘
  - IP Parser & Validator                           - Setup & Admin Creation
  - Fallback IP Mirrors                             - Session Authentication
  - AES-256-GCM Crypto                              - Navigation & Breadcrumbs
  - Bcrypt Password Security                        - Theme Toggle (Dark/Light)
  - Cloudflare v4 Adapter                           - Cloudflare Connection Modal
  - DDNS Engine & Mutex Lock                        - Record & Job Modals
  - Remote Agent Hashing                            - Remote Agent Generation
                                                    - Remote IP Reporting API
                                                    - Multi-Viewport Screenshots
```

---

## 2. Unit & Integration Testing (Vitest)

Unit tests run in an isolated Node.js environment without modifying external Cloudflare DNS records:

- `src/__tests__/ip-detector.test.ts`: Verifies standard, compressed, and loopback IPv4/IPv6 addresses, checks invalid IP rejections, and tests network fallback mirror logic.
- `src/__tests__/crypto.test.ts`: Tests AES-256-GCM encryption roundtrips, ensures tampering detection triggers an error, and checks SHA-256 hashing stability.
- `src/__tests__/auth.test.ts`: Tests password salting and bcrypt verification.
- `src/__tests__/cloudflare.test.ts`: Tests official Cloudflare API responses including token verification, zone enumerations, record creation, PATCH updates preserving proxies, and HTTP 429 rate limit errors.

### Running Vitest
```bash
npm run test
```

---

## 3. End-to-End Browser Testing (Playwright)

Playwright runs against the live server across two core device configurations:
1. **Desktop Chrome**: `1440x900`
2. **Mobile Chrome**: `390x844`

- `e2e/pulsedns.spec.ts`: Executes the complete administrator lifecycle: initial master setup, login, dashboard rendering, navigation across all 6 pages, agent token creation, remote IP update dispatch via HTTP POST, and audit log verification.
- `e2e/modals-and-forms.spec.ts`: Interactively opens the Cloudflare connection modal, types an invalid token, verifies the real Cloudflare `[6003] Invalid request headers` response, tests modal dismissals, and validates DDNS Job creation forms.

### Running Playwright Tests
```bash
npm run test:e2e
```

---

## 4. Multi-Viewport Visual Inspection & Screenshots

PulseDNS includes an automated visual snapshot generator that captures screenshots across 5 standard viewport resolutions:

| Viewport Target | Width x Height | File Name Pattern |
|---|---|---|
| Desktop Widescreen | 1920 x 1080 | `screenshots/<page>_1920px.png` |
| Laptop Display | 1440 x 900 | `screenshots/<page>_1440px.png` |
| Tablet Portrait | 768 x 1024 | `screenshots/<page>_768px.png` |
| Mobile Standard | 390 x 844 | `screenshots/<page>_390px.png` |
| Mobile Compact | 375 x 667 | `screenshots/<page>_375px.png` |

### Capturing Screenshots
```bash
npx playwright test e2e/screenshots.spec.ts --project="Desktop Chrome"
```
All images are exported to the `./screenshots` directory for visual review.
