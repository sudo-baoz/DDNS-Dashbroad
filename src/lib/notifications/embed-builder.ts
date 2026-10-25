import {
  NotificationEvent,
  DiscordEmbed,
  DiscordEmbedField,
  DiscordWebhookPayload,
} from './types';

// Discord Embed Colors (decimal integers)
export const DISCORD_COLORS = {
  GREEN: 3066993,  // 0x2ECC71 - Success / Recovery
  RED: 15158332,   // 0xE74C3C - Failure / Outage
  AMBER: 15965458, // 0xF39C12 - Warning
  BLUE: 3447003,   // 0x3498DB - Info / IP Changed
  PURPLE: 10181046 // 0x9B59B6 - Status Summary
};

export interface EmbedBuilderOptions {
  includeIpAddresses?: boolean;
  timezone?: string;
  botName?: string;
  avatarUrl?: string;
}

/**
 * Mask an IP address if includeIpAddresses is false.
 */
export function formatIp(ip?: string | null, includeIp: boolean = true): string {
  if (!ip) return 'N/A';
  if (includeIp) return ip;

  // Mask IPv4: 203.0.113.20 -> 203.0.***.***
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
  }

  // Mask IPv6: 2001:db8:85a3::8a2e:370:7334 -> 2001:db8:****::****
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length > 2) {
      return `${parts[0]}:${parts[1]}:****::****`;
    }
  }

  return '[Hidden]';
}

function truncate(str: string, maxLength: number): string {
  if (!str) return '';
  return str.length > maxLength ? `${str.slice(0, maxLength - 3)}...` : str;
}

/**
 * Format a timestamp with a given timezone or return ISO string.
 */
function formatTimestamp(date: Date, timezone?: string): string {
  try {
    if (timezone) {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZoneName: 'short',
      }).format(date);
    }
  } catch {
    // fallback
  }
  return date.toISOString();
}

/**
 * Build a structured Discord Embed for a given NotificationEvent.
 */
export function buildDiscordEmbed(
  event: NotificationEvent,
  options: EmbedBuilderOptions = {}
): DiscordEmbed {
  const includeIp = options.includeIpAddresses !== false;
  const eventDate = event.timestamp || new Date();
  const formattedTime = formatTimestamp(eventDate, options.timezone);

  let title = event.title;
  let description = event.description;
  let color = DISCORD_COLORS.BLUE;
  const fields: DiscordEmbedField[] = [];

  switch (event.type) {
    case 'PUBLIC_IP_CHANGED':
      title = '🌐 Public IP Changed';
      description = 'A monitored public IP address has changed.';
      color = DISCORD_COLORS.BLUE;
      if (event.domain) {
        fields.push({ name: 'Hostname / Domain', value: `\`${event.domain}\``, inline: false });
      }
      if (event.recordType) {
        fields.push({ name: 'Record', value: event.recordType, inline: true });
      }
      fields.push({ name: 'Previous IP', value: `\`${formatIp(event.previousIp, includeIp)}\``, inline: true });
      fields.push({ name: 'New IP', value: `\`${formatIp(event.newIp, includeIp)}\``, inline: true });
      if (event.detectionSource) {
        fields.push({ name: 'Source', value: event.detectionSource, inline: true });
      }
      break;

    case 'DNS_UPDATE_SUCCESS':
      title = '✅ DNS Update Succeeded';
      description = `Cloudflare DNS record has been successfully updated.`;
      color = DISCORD_COLORS.GREEN;
      if (event.domain) {
        fields.push({ name: 'Hostname / Domain', value: `\`${event.domain}\``, inline: false });
      }
      if (event.recordType) {
        fields.push({ name: 'Record', value: event.recordType, inline: true });
      }
      fields.push({ name: 'Previous DNS IP', value: `\`${formatIp(event.previousIp, includeIp)}\``, inline: true });
      fields.push({ name: 'New DNS IP', value: `\`${formatIp(event.newIp, includeIp)}\``, inline: true });
      fields.push({ name: 'Provider', value: event.provider || 'Cloudflare', inline: true });
      if (event.latencyMs !== undefined) {
        fields.push({ name: 'Latency', value: `${event.latencyMs} ms`, inline: true });
      }
      if (event.jobName) {
        fields.push({ name: 'Job', value: event.jobName, inline: true });
      }
      break;

    case 'DNS_UPDATE_FAILED':
      title = '❌ DNS Update Failed';
      description = `Failed to update DNS record on Cloudflare.`;
      color = DISCORD_COLORS.RED;
      if (event.domain) {
        fields.push({ name: 'Hostname / Domain', value: `\`${event.domain}\``, inline: false });
      }
      if (event.recordType) {
        fields.push({ name: 'Record', value: event.recordType, inline: true });
      }
      if (event.errorCategory) {
        fields.push({ name: 'Error Category', value: event.errorCategory, inline: true });
      }
      fields.push({
        name: 'Error Details',
        value: `\`\`\`\n${truncate(event.errorMessage || 'Unknown error', 900)}\n\`\`\``,
        inline: false,
      });
      if (event.attemptCount !== undefined) {
        fields.push({ name: 'Attempt', value: `${event.attemptCount}`, inline: true });
      }
      if (event.jobName) {
        fields.push({ name: 'Job', value: event.jobName, inline: true });
      }
      break;

    case 'PROVIDER_CONNECTION_LOST':
      title = '⚠️ Cloudflare Connection Lost';
      description = `Unable to communicate with Cloudflare DNS API.`;
      color = DISCORD_COLORS.RED;
      fields.push({ name: 'Provider', value: event.provider || 'Cloudflare', inline: true });
      if (event.attemptCount !== undefined) {
        fields.push({ name: 'Consecutive Failures', value: `${event.attemptCount}`, inline: true });
      }
      if (event.errorMessage) {
        fields.push({
          name: 'Details',
          value: `\`\`\`\n${truncate(event.errorMessage, 900)}\n\`\`\``,
          inline: false,
        });
      }
      break;

    case 'PROVIDER_CONNECTION_RECOVERED':
      title = '🔄 Cloudflare Connection Recovered';
      description = `Connection to Cloudflare DNS API has been restored.`;
      color = DISCORD_COLORS.GREEN;
      fields.push({ name: 'Provider', value: event.provider || 'Cloudflare', inline: true });
      if (event.outageDurationSeconds !== undefined) {
        const mins = Math.floor(event.outageDurationSeconds / 60);
        const secs = event.outageDurationSeconds % 60;
        const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        fields.push({ name: 'Outage Duration', value: durationStr, inline: true });
      }
      break;

    case 'JOB_STATUS_CHANGED':
      title = '⚙️ DDNS Job Status Changed';
      description = event.description;
      color = event.severity === 'ERROR' ? DISCORD_COLORS.RED : DISCORD_COLORS.AMBER;
      if (event.jobName) {
        fields.push({ name: 'Job', value: event.jobName, inline: true });
      }
      if (event.domain) {
        fields.push({ name: 'Domain', value: `\`${event.domain}\``, inline: true });
      }
      if (event.metadata?.status) {
        fields.push({ name: 'New Status', value: event.metadata.status, inline: true });
      }
      break;

    case 'AGENT_STATUS_CHANGED':
      title = event.severity === 'ERROR' ? '🚨 Remote Agent Offline' : '🟢 Remote Agent Online';
      description = event.description;
      color = event.severity === 'ERROR' ? DISCORD_COLORS.RED : DISCORD_COLORS.GREEN;
      if (event.metadata?.agentName) {
        fields.push({ name: 'Agent', value: event.metadata.agentName, inline: true });
      }
      if (event.previousIp || event.newIp) {
        fields.push({ name: 'Reported IP', value: `\`${formatIp(event.newIp || event.previousIp, includeIp)}\``, inline: true });
      }
      break;

    case 'SYSTEM_STARTUP':
      title = '🚀 PulseDNS Services Started';
      description = 'PulseDNS background monitoring and DDNS scheduler are now running.';
      color = DISCORD_COLORS.GREEN;
      fields.push({ name: 'Environment', value: 'Production / Homelab', inline: true });
      fields.push({ name: 'Worker', value: 'Active', inline: true });
      break;

    case 'PERIODIC_SUMMARY':
      title = '📊 PulseDNS Status Digest';
      description = 'Periodic summary of DDNS monitoring activities.';
      color = DISCORD_COLORS.PURPLE;
      if (event.metadata) {
        if (event.metadata.managedDomains !== undefined) {
          fields.push({ name: 'Managed Domains', value: `${event.metadata.managedDomains}`, inline: true });
        }
        if (event.metadata.activeJobs !== undefined) {
          fields.push({ name: 'Active Jobs', value: `${event.metadata.activeJobs}`, inline: true });
        }
        if (event.metadata.successfulUpdates !== undefined) {
          fields.push({ name: 'Successful Updates (24h)', value: `${event.metadata.successfulUpdates}`, inline: true });
        }
        if (event.metadata.failedUpdates !== undefined) {
          fields.push({ name: 'Failed Updates (24h)', value: `${event.metadata.failedUpdates}`, inline: true });
        }
        if (event.metadata.ipChanges !== undefined) {
          fields.push({ name: 'IP Changes Detected', value: `${event.metadata.ipChanges}`, inline: true });
        }
        if (event.metadata.providerHealth !== undefined) {
          fields.push({ name: 'Provider Status', value: `${event.metadata.providerHealth}`, inline: true });
        }
      }
      break;

    default:
      title = event.title || 'PulseDNS Notification';
      description = event.description || '';
      color = event.severity === 'ERROR' ? DISCORD_COLORS.RED : DISCORD_COLORS.BLUE;
      break;
  }

  // Always append timestamp in configured timezone as a structured field for readability
  fields.push({
    name: 'Event Time',
    value: formattedTime,
    inline: false,
  });

  return {
    title: truncate(title, 256),
    description: truncate(description, 4096),
    color,
    fields: fields.slice(0, 25).map(f => ({
      name: truncate(f.name, 256),
      value: truncate(f.value, 1024),
      inline: f.inline ?? true,
    })),
    footer: {
      text: 'PulseDNS • DDNS Monitoring',
    },
    timestamp: eventDate.toISOString(),
  };
}

/**
 * Build test notification webhook payload.
 */
export function buildTestWebhookPayload(options: EmbedBuilderOptions = {}): DiscordWebhookPayload {
  const now = new Date();
  const formattedTime = formatTimestamp(now, options.timezone);

  return {
    username: options.botName || 'PulseDNS',
    avatar_url: options.avatarUrl || undefined,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: '✅ PulseDNS Webhook Connected',
        description: 'Discord notifications have been configured and verified successfully.',
        color: DISCORD_COLORS.GREEN,
        fields: [
          { name: 'Application', value: 'PulseDNS', inline: true },
          { name: 'Integration', value: 'Discord Webhook', inline: true },
          { name: 'Status', value: 'Connected & Verified', inline: true },
          { name: 'Test Time', value: formattedTime, inline: false },
        ],
        footer: {
          text: 'PulseDNS • Notification Test',
        },
        timestamp: now.toISOString(),
      },
    ],
  };
}

/**
 * Wrap Discord embeds into a full webhook execution payload.
 */
export function buildWebhookPayload(
  embeds: DiscordEmbed[],
  options: EmbedBuilderOptions = {}
): DiscordWebhookPayload {
  return {
    username: options.botName || 'PulseDNS',
    avatar_url: options.avatarUrl || undefined,
    allowed_mentions: { parse: [] },
    embeds,
  };
}
