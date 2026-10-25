export type NotificationEventType =
  | 'PUBLIC_IP_CHANGED'
  | 'DNS_UPDATE_SUCCESS'
  | 'DNS_UPDATE_FAILED'
  | 'PROVIDER_CONNECTION_LOST'
  | 'PROVIDER_CONNECTION_RECOVERED'
  | 'JOB_STATUS_CHANGED'
  | 'AGENT_STATUS_CHANGED'
  | 'SYSTEM_STARTUP'
  | 'PERIODIC_SUMMARY';

export type NotificationSeverity = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

export type DeliveryStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'RETRYING'
  | 'FAILED'
  | 'CANCELLED';

export type ChannelStatus =
  | 'NOT_CONFIGURED'
  | 'CONNECTED'
  | 'DISABLED'
  | 'INVALID_WEBHOOK'
  | 'RATE_LIMITED'
  | 'DELIVERY_FAILED';

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbedFooter {
  text: string;
  icon_url?: string;
}

export interface DiscordEmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
}

export interface DiscordEmbed {
  title: string;
  description?: string;
  url?: string;
  color: number; // Discord integer color
  fields?: DiscordEmbedField[];
  footer?: DiscordEmbedFooter;
  author?: DiscordEmbedAuthor;
  timestamp?: string; // ISO 8601
}

export interface DiscordWebhookPayload {
  username?: string;
  avatar_url?: string;
  content?: string;
  embeds: DiscordEmbed[];
  allowed_mentions: {
    parse: string[];
    users?: string[];
    roles?: string[];
  };
}

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  retryAfterMs?: number;
  isPermanentFailure?: boolean;
  messageId?: string;
}

export interface NotificationEvent {
  type: NotificationEventType;
  severity: NotificationSeverity;
  title: string;
  description: string;
  domain?: string;
  jobId?: string;
  jobName?: string;
  recordType?: string;
  previousIp?: string;
  newIp?: string;
  detectionSource?: string;
  provider?: string;
  latencyMs?: number;
  attemptCount?: number;
  errorCategory?: string;
  errorMessage?: string;
  outageDurationSeconds?: number;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface NotificationProvider {
  name: string;
  send(
    webhookUrl: string,
    payload: DiscordWebhookPayload,
    options?: { wait?: boolean; timeoutMs?: number }
  ): Promise<DeliveryResult>;
  validateUrl(url: string): { valid: boolean; reason?: string };
}
