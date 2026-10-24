export interface ProviderCapabilities {
  supportsIPv4: boolean;
  supportsIPv6: boolean;
  supportsProxied: boolean;
  supportsTTL: boolean;
  supportsZoneListing: boolean;
  supportsRecordCreation: boolean;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  accountId?: string;
  accountEmail?: string;
}

export interface ProviderZone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
}

export interface ProviderRecord {
  id: string;
  zoneId: string;
  name: string;
  type: 'A' | 'AAAA' | string;
  content: string;
  proxied?: boolean;
  ttl?: number;
  comment?: string;
}

export interface CreateRecordInput {
  name: string;
  type: 'A' | 'AAAA';
  content: string;
  proxied?: boolean;
  ttl?: number;
  comment?: string;
}

export interface UpdateRecordInput {
  name?: string;
  type?: 'A' | 'AAAA';
  content: string;
  proxied?: boolean;
  ttl?: number;
  comment?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
}

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

  updateRecord(
    credentials: Record<string, any>,
    zoneId: string,
    recordId: string,
    input: UpdateRecordInput
  ): Promise<ProviderRecord>;

  deleteRecord?(credentials: Record<string, any>, zoneId: string, recordId: string): Promise<boolean>;
}

export interface ProviderMetadata {
  id: string;
  name: string;
  description: string;
  website: string;
  status: 'active' | 'coming_soon';
  authFields: {
    key: string;
    label: string;
    type: 'password' | 'text';
    placeholder: string;
    description: string;
    required: boolean;
  }[];
}
