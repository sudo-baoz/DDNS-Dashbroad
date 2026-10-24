import {
  DNSProviderAdapter,
  ProviderCapabilities,
  ValidationResult,
  ConnectionTestResult,
  ProviderZone,
  ProviderRecord,
  CreateRecordInput,
  UpdateRecordInput,
} from './types';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

interface CloudflareApiResponse<T> {
  success: boolean;
  errors: { code: number; message: string }[];
  messages: { code: number; message: string }[];
  result: T;
  result_info?: {
    page: number;
    per_page: number;
    count: number;
    total_count: number;
    total_pages: number;
  };
}

export class CloudflareAdapter implements DNSProviderAdapter {
  readonly providerId = 'cloudflare';
  readonly providerName = 'Cloudflare DNS';

  getCapabilities(): ProviderCapabilities {
    return {
      supportsIPv4: true,
      supportsIPv6: true,
      supportsProxied: true,
      supportsTTL: true,
      supportsZoneListing: true,
      supportsRecordCreation: true,
    };
  }

  private getHeaders(apiToken: string): HeadersInit {
    return {
      Authorization: `Bearer ${apiToken.trim()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'PulseDNS-DDNS/1.0',
    };
  }

  private async request<T>(
    endpoint: string,
    apiToken: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${CLOUDFLARE_API_BASE}${endpoint}`;
    const headers = { ...this.getHeaders(apiToken), ...options.headers };

    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        headers,
      });
    } catch (networkErr: any) {
      throw new Error(`Cloudflare network error: ${networkErr.message || 'Connection failed'}`);
    }

    let data: CloudflareApiResponse<T>;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Cloudflare API returned invalid response (HTTP ${res.status})`);
    }

    if (!data.success) {
      const errorMsg =
        data.errors?.map((e) => `[${e.code}] ${e.message}`).join(', ') ||
        `Cloudflare API error (HTTP ${res.status})`;
      throw new Error(errorMsg);
    }

    return data.result;
  }

  async testConnection(credentials: Record<string, any>): Promise<ConnectionTestResult> {
    const apiToken = credentials.apiToken;
    if (!apiToken) {
      return { success: false, message: 'Cloudflare API Token is required.' };
    }

    try {
      // 1. Verify token validity
      const verifyResult = await this.request<{ id: string; status: string }>(
        '/user/tokens/verify',
        apiToken
      );

      if (verifyResult.status !== 'active') {
        return {
          success: false,
          message: `API Token status is "${verifyResult.status}". Token must be active.`,
        };
      }

      // 2. Test zone access
      const zones = await this.listZones(credentials);

      return {
        success: true,
        message: `Successfully authenticated! Found ${zones.length} accessible DNS zones.`,
        details: {
          tokenId: verifyResult.id,
          zoneCount: zones.length,
          zones: zones.map((z) => z.name),
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to authenticate with Cloudflare.',
      };
    }
  }

  async validateCredentials(credentials: Record<string, any>): Promise<ValidationResult> {
    const apiToken = credentials.apiToken;
    if (!apiToken || typeof apiToken !== 'string' || apiToken.trim().length === 0) {
      return { valid: false, message: 'API Token cannot be empty.' };
    }

    try {
      const verifyResult = await this.request<{ id: string; status: string }>(
        '/user/tokens/verify',
        apiToken
      );

      if (verifyResult.status === 'active') {
        return { valid: true, message: 'Token is active and valid.' };
      }
      return { valid: false, message: `Token status: ${verifyResult.status}` };
    } catch (err: any) {
      return { valid: false, message: err.message || 'Token verification failed.' };
    }
  }

  async listZones(credentials: Record<string, any>): Promise<ProviderZone[]> {
    const apiToken = credentials.apiToken;
    if (!apiToken) throw new Error('API Token required');

    interface CFZone {
      id: string;
      name: string;
      status: string;
      paused: boolean;
    }

    const zones = await this.request<CFZone[]>('/zones?per_page=50', apiToken);
    return zones.map((z) => ({
      id: z.id,
      name: z.name,
      status: z.status,
      paused: z.paused,
    }));
  }

  async listRecords(credentials: Record<string, any>, zoneId: string): Promise<ProviderRecord[]> {
    const apiToken = credentials.apiToken;
    if (!apiToken) throw new Error('API Token required');

    interface CFRecord {
      id: string;
      zone_id: string;
      name: string;
      type: string;
      content: string;
      proxied?: boolean;
      ttl?: number;
      comment?: string;
    }

    const records = await this.request<CFRecord[]>(
      `/zones/${zoneId}/dns_records?per_page=100`,
      apiToken
    );

    return records.map((r) => ({
      id: r.id,
      zoneId: r.zone_id,
      name: r.name,
      type: r.type,
      content: r.content,
      proxied: r.proxied,
      ttl: r.ttl,
      comment: r.comment,
    }));
  }

  async getRecord(
    credentials: Record<string, any>,
    zoneId: string,
    recordId: string
  ): Promise<ProviderRecord> {
    const apiToken = credentials.apiToken;
    if (!apiToken) throw new Error('API Token required');

    interface CFRecord {
      id: string;
      zone_id: string;
      name: string;
      type: string;
      content: string;
      proxied?: boolean;
      ttl?: number;
      comment?: string;
    }

    const r = await this.request<CFRecord>(
      `/zones/${zoneId}/dns_records/${recordId}`,
      apiToken
    );

    return {
      id: r.id,
      zoneId: r.zone_id,
      name: r.name,
      type: r.type,
      content: r.content,
      proxied: r.proxied,
      ttl: r.ttl,
      comment: r.comment,
    };
  }

  async createRecord(
    credentials: Record<string, any>,
    zoneId: string,
    input: CreateRecordInput
  ): Promise<ProviderRecord> {
    const apiToken = credentials.apiToken;
    if (!apiToken) throw new Error('API Token required');

    const payload: Record<string, any> = {
      type: input.type,
      name: input.name,
      content: input.content,
      ttl: input.ttl || 1, // 1 is Auto in Cloudflare
    };

    if (typeof input.proxied === 'boolean') {
      payload.proxied = input.proxied;
    }
    if (input.comment) {
      payload.comment = input.comment;
    }

    interface CFRecord {
      id: string;
      zone_id: string;
      name: string;
      type: string;
      content: string;
      proxied?: boolean;
      ttl?: number;
      comment?: string;
    }

    const created = await this.request<CFRecord>(
      `/zones/${zoneId}/dns_records`,
      apiToken,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    return {
      id: created.id,
      zoneId: created.zone_id,
      name: created.name,
      type: created.type,
      content: created.content,
      proxied: created.proxied,
      ttl: created.ttl,
      comment: created.comment,
    };
  }

  async updateRecord(
    credentials: Record<string, any>,
    zoneId: string,
    recordId: string,
    input: UpdateRecordInput
  ): Promise<ProviderRecord> {
    const apiToken = credentials.apiToken;
    if (!apiToken) throw new Error('API Token required');

    // Use PATCH to preserve existing properties (proxied, comment, ttl) unless changed
    const payload: Record<string, any> = {
      content: input.content,
    };

    if (input.name) payload.name = input.name;
    if (input.type) payload.type = input.type;
    if (typeof input.proxied === 'boolean') payload.proxied = input.proxied;
    if (input.ttl !== undefined) payload.ttl = input.ttl;
    if (input.comment !== undefined) payload.comment = input.comment;

    interface CFRecord {
      id: string;
      zone_id: string;
      name: string;
      type: string;
      content: string;
      proxied?: boolean;
      ttl?: number;
      comment?: string;
    }

    const updated = await this.request<CFRecord>(
      `/zones/${zoneId}/dns_records/${recordId}`,
      apiToken,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );

    return {
      id: updated.id,
      zoneId: updated.zone_id,
      name: updated.name,
      type: updated.type,
      content: updated.content,
      proxied: updated.proxied,
      ttl: updated.ttl,
      comment: updated.comment,
    };
  }

  async deleteRecord(
    credentials: Record<string, any>,
    zoneId: string,
    recordId: string
  ): Promise<boolean> {
    const apiToken = credentials.apiToken;
    if (!apiToken) throw new Error('API Token required');

    await this.request<{ id: string }>(
      `/zones/${zoneId}/dns_records/${recordId}`,
      apiToken,
      {
        method: 'DELETE',
      }
    );

    return true;
  }
}
