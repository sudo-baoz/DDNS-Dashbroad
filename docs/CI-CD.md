# PulseDNS CI/CD Pipeline Architecture & Operations Guide

This document describes the continuous integration, testing, containerization, security scanning, and container registry publishing pipeline for PulseDNS.

---

## 1. Pipeline Overview

PulseDNS uses **GitHub Actions** for automated testing and **GitHub Container Registry (GHCR)** for distributing verified Docker container images.

```text
                  Developer Push / Pull Request
                                 │
                                 ▼
                     GitHub Actions Triggers
                     (push, PR, merge_group)
                                 │
         ┌───────────────────────┼────────────────────────┐
         │                       │                        │
         ▼                       ▼                        ▼
 ┌───────────────┐       ┌───────────────┐        ┌───────────────┐
 │ Code Quality  │       │  Unit Tests   │        │   E2E Tests   │
 │ ESLint + TSC  │       │ Vitest Suite  │        │  Playwright   │
 └───────┬───────┘       └───────┬───────┘        └───────┬───────┘
         │                       │                        │
         └───────────────────────┼────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Docker Build & Smoke    │
                    │ Buildx + Health Probe   │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Security Vulnerability  │
                    │ Trivy FS + NPM Audit    │
                    └────────────┬────────────┘
                                 │
                        ALL CHECKS PASSED?
                               /   \
                             NO     YES
                             /       \
                            ▼         ▼
                      Block Release   Publish Multi-Arch Image to GHCR
                                      (Only trusted main branch & v* tags)
```

---

## 2. Workflows & Directory Layout

```text
.github/
├── workflows/
│   ├── ci.yml             # Main CI/CD Pipeline (Quality, Tests, Docker Smoke, Security, GHCR)
│   └── security.yml       # Scheduled Weekly Security & Hadolint Dockerfile Analysis
├── dependabot.yml         # Dependabot automated dependency & action updates
└── pull_request_template.md # PR checklist and verification requirements
```

---

## 3. GitHub Actions Triggers & Concurrency

### Triggers (`.github/workflows/ci.yml`)
- **Pushes to `main`**: Runs the entire test matrix, builds the container, and publishes the image to GHCR upon success.
- **Pushes to feature branches (`feat/**`, `fix/**`, `releases/**`)**: Runs quality, unit tests, E2E tests, and Docker build/smoke tests without publishing images.
- **Pull Requests targeting `main`**: Runs all quality and test checks. Pull requests are **strictly forbidden** from publishing images.
- **Merge Queue (`merge_group`)**: Validates pull request merges before updating the `main` branch.
- **Manual Dispatch (`workflow_dispatch`)**: Allows manual execution and safe re-publishing on `main`.

### Concurrency
Pull request runs cancel superseded jobs automatically to save runner minutes:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

---

## 4. Permissions & Security Hardening

In accordance with least-privilege security principles:

1. **Default workflow permissions** are read-only:
   ```yaml
   permissions:
     contents: read
   ```
2. **GHCR Publishing job** is isolated and explicitly granted package write rights:
   ```yaml
   publish-ghcr:
     permissions:
       contents: read
       packages: write
   ```
3. **No credentials in source control**: Disposable test secrets are supplied in workflow environments. Live tokens are never stored in repositories.
4. **Fork protection**: Forked PRs cannot access repository secrets or publish to GHCR.

---

## 5. Image Tagging & Registry Architecture

Images are built for multiple target architectures:
- `linux/amd64` (Standard x86_64 servers & cloud VPS)
- `linux/arm64` (Apple Silicon, Raspberry Pi 4/5, AWS Graviton, Oracle ARM)

Published to:
```text
ghcr.io/sudo-baoz/ddns-dashbroad
```

### Tagging Rules:
| Event | Tags Generated | Purpose |
|---|---|---|
| Push to `main` | `main`, `sha-<short-sha>`, `latest` | Continuous delivery of latest validated main branch |
| Tag `v1.2.3` | `1.2.3`, `1.2`, `1`, `latest` | Semantic version release |
| Pull Request | *No tags published* | PR isolation — images are tested locally and discarded |

---

## 6. Docker Runtime Smoke Testing

A build succeeding does not guarantee the container operates properly at runtime. PulseDNS implements an isolated runtime verification step:

1. Build container with Buildx using GitHub Actions cache (`type=gha`).
2. Run container using `scripts/smoke-test.sh`:
   ```bash
   ./scripts/smoke-test.sh pulsedns:smoke-test 3055
   ```
3. Test container lifecycle:
   - Verifies SQLite data directory permissions (`node:node`).
   - Polls `/api/health` up to 30s.
   - Validates JSON output: `{"status":"healthy","database":"connected","worker":"active"}`.
   - Verifies root HTTP response (`HTTP 200`).
   - Dumps container logs if any check fails.
   - Cleans up and removes the test container on completion.

---

## 7. Local Pipeline Execution

To run all pipeline checks on your local machine before pushing:

### 1. Code Quality & Strict Typecheck
```bash
npm run lint
npm run typecheck
```

### 2. Unit & Integration Tests
```bash
npm run test
```

### 3. Playwright End-to-End Tests
```bash
npx playwright test e2e/pulsedns.spec.ts e2e/modals-and-forms.spec.ts
```

### 4. Docker Build & Smoke Test
```bash
docker build -t pulsedns:local-test .
./scripts/smoke-test.sh pulsedns:local-test 3055
```

---

## 8. Troubleshooting CI Failures

### Type Error or Lint Failure
- **Error**: `TS2322: Type ... is not assignable to type ...`
- **Resolution**: Run `npm run typecheck` locally. Correct interface definitions or type annotations. Do not use `@ts-ignore` to silence real bugs.

### Unit Test Failure
- **Error**: `AssertionError: expected ... to deeply equal ...`
- **Resolution**: Run `npm run test` locally with Vitest. Inspect mock data or external API contracts.

### Playwright E2E Failure
- **Error**: `Timed out 5000ms waiting for locator(...)`
- **Resolution**: Download the `playwright-e2e-artifacts` uploaded to the failed GitHub Actions run. Review the HTML trace with `npx playwright show-trace trace.zip` to inspect screenshots and DOM snapshots at failure.

### Docker Smoke Test Failure
- **Error**: `Container failed to become healthy within 30 seconds`
- **Resolution**: Check the container log output emitted by `smoke-test.sh`. Ensure SQLite database path `/app/data/pulsedns.db` has write permissions for user `node` and that environment variables are valid.
