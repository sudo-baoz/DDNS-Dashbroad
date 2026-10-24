# PulseDNS — System Architecture

This document describes the architectural principles, data flow, provider abstraction layers, and background scheduler mechanics of PulseDNS.

```mermaid
graph TD
    Client[Web Browser / Dashboard UI] -->|HTTP / Secure Cookie| API[Next.js App Router API Routes]
    RemoteAgent[Remote Home Server / Router] -->|Bearer Token HTTP POST| AgentAPI[/api/agent/update]
    
    API --> Auth[Authentication & Session Guard]
    API --> Engine[DDNS Automation Engine]
    AgentAPI --> Engine

    subgraph "DDNS Execution Engine"
        Engine --> IPDetect[Public IP Detector (IPv4 / IPv6)]
        Engine --> Lock[In-Memory Concurrency Mutex]
        Engine --> Comparator[IP Difference Comparator]
        Engine --> Retry[Bounded Backoff Retry]
    end

    subgraph "Provider Plugin Layer"
        Comparator --> Factory[Provider Factory Registry]
        Factory --> Cloudflare[Cloudflare DNS Adapter v4]
        Factory -.-> DuckDNS[DuckDNS Adapter - Coming Soon]
        Factory -.-> AWS[AWS Route 53 - Coming Soon]
    end

    Cloudflare --> CFAPI[Cloudflare Public API v4]

    subgraph "Persistence & Telemetry"
        Engine --> DB[(Prisma ORM SQLite / Postgres)]
        Engine --> Audit[Audit & Structured Logger]
    end

    subgraph "Continuous Automation"
        Instrumentation[Server Startup (instrumentation.ts)] --> Worker[Background Scheduler Daemon]
        Worker -->|Check Due Jobs Every 10s| Engine
        Worker -->|Heartbeat Every 15s| DB
    end
```

---

## 1. Provider Adapter Architecture

To prevent provider-specific lock-in, all DNS operations are routed through a standardized TypeScript interface:

```typescript
export interface DNSProviderAdapter {
  readonly providerId: string;
  readonly providerName: string;

  getCapabilities(): ProviderCapabilities;
  testConnection(credentials: Record<string, any>): Promise<ConnectionTestResult>;
  validateCredentials(credentials: Record<string, any>): Promise<ValidationResult>;
  listZones(credentials: Record<string, any>): Promise<ProviderZone[]>;
  listRecords(credentials: Record<string, any>, zoneId: string): Promise<ProviderRecord[]>;
  getRecord(credentials: Record<string, any>, zoneId: string, recordId: string): Promise<ProviderRecord>;
  createRecord(credentials: Record<string, any>, zoneId: string, input: CreateRecordInput): Promise<ProviderRecord>;
  updateRecord(credentials: Record<string, any>, zoneId: string, recordId: string, input: UpdateRecordInput): Promise<ProviderRecord>;
  deleteRecord?(credentials: Record<string, any>, zoneId: string, recordId: string): Promise<boolean>;
}
```

### Implementing Future Providers
Adding providers (such as DuckDNS, AWS Route 53, or Google Cloud DNS) is accomplished by:
1. Creating an adapter in `src/lib/providers/<provider-name>.ts` implementing `DNSProviderAdapter`.
2. Registering the adapter in `src/lib/providers/factory.ts`.
3. Updating the status in `PROVIDERS_METADATA` from `'coming_soon'` to `'active'`.
No modifications to the core DDNS engine, database models, or scheduler are required.

---

## 2. Cloudflare DNS Integration (Phase 1)

PulseDNS communicates with official Cloudflare v4 REST API endpoints:
- **Token Verification**: `GET https://api.cloudflare.com/client/v4/user/tokens/verify`
- **Zone Enumeration**: `GET https://api.cloudflare.com/client/v4/zones?per_page=50`
- **Record Listing**: `GET https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records`
- **Record Update**: `PATCH https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{record_id}`

### Properties Preservation
When updating DNS records, Cloudflare's `PATCH` endpoint is utilized with targeted fields. Existing properties such as `proxied` (orange cloud vs gray cloud), `ttl`, and comments are strictly preserved unless explicitly edited by the user.

---

## 3. DDNS Automation & Update Lifecycle

The DDNS execution loop follows strict idempotency and change-detection rules:

1. **Trigger**: Fired either automatically by the background worker, via manual "Run Now" in the UI, or upon receipt of a Remote Agent check-in.
2. **Concurrency Guard**: A per-job in-memory lock (`activeJobLocks`) rejects duplicate concurrent triggers.
3. **Target IP Resolution**:
   - `SERVER_IP`: Outbound detection using redundant mirrors (`api.ipify.org`, `icanhazip.com`, `ifconfig.me`).
   - `REMOTE_AGENT`: Looked up from the authenticated agent's latest reported IP.
4. **Validation**: IP string is parsed against strict IPv4 or IPv6 regular expressions and Node `net.isIP`.
5. **No-Change Optimization**:
   - If the detected IP is identical to the current DNS record IP, an audit status of `NO_CHANGE` is recorded.
   - **No outbound write request is dispatched to Cloudflare**, preventing unnecessary API rate limit usage and audit clutter.
6. **Provider Update**:
   - Provider credentials are decrypted using AES-256-GCM.
   - Cloudflare API is invoked to update the record.
   - Response payload is validated for `success: true`.
7. **Persistence & History**:
   - `DdnsExecution` record is written with latency measurement in milliseconds.
   - `IpHistory` tracks old IP -> new IP progression.
   - Next execution timestamp is updated based on configured interval.

---

## 4. Background Scheduler Daemon

PulseDNS utilizes Next.js server instrumentation (`src/instrumentation.ts`):
- When the Node.js server bootstraps, `register()` initializes `startDDNSScheduler()`.
- The worker executes independently of user browser sessions.
- An in-memory timer polls due jobs every 10 seconds.
- A heartbeat timestamp is written to `ApplicationSettings` every 15 seconds, enabling the UI to accurately reflect worker health (`ACTIVE` vs `IDLE`).
- Graceful shutdown handles `SIGINT` and `SIGTERM` signals to terminate ongoing operations safely.
