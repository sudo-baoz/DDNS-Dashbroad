import prisma from './prisma';

export type AuditAction =
  | 'AUTH_SETUP'
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_PASSWORD_CHANGE'
  | 'PROVIDER_CONNECT'
  | 'PROVIDER_DISCONNECT'
  | 'PROVIDER_ERROR'
  | 'ZONE_SYNC'
  | 'RECORD_CREATE'
  | 'RECORD_UPDATE'
  | 'RECORD_MANAGE_TOGGLE'
  | 'JOB_CREATE'
  | 'JOB_UPDATE'
  | 'JOB_DELETE'
  | 'JOB_EXECUTE'
  | 'DNS_UPDATE'
  | 'IP_CHANGE'
  | 'AGENT_TOKEN_CREATE'
  | 'AGENT_TOKEN_REVOKE'
  | 'SETTINGS_UPDATE';

export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

interface AuditLogOptions {
  action: AuditAction;
  severity?: AuditSeverity;
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Sanitize metadata to ensure no sensitive tokens or secrets are saved.
 */
function sanitizeMetadata(data?: Record<string, any>): Record<string, any> | undefined {
  if (!data) return undefined;
  const sensitiveKeys = ['token', 'password', 'secret', 'key', 'credentials', 'authorization', 'bearer'];
  const sanitized: Record<string, any> = {};

  for (const [k, v] of Object.entries(data)) {
    const isSensitive = sensitiveKeys.some((s) => k.toLowerCase().includes(s));
    if (isSensitive) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      sanitized[k] = sanitizeMetadata(v);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}

/**
 * Record an audit log event safely.
 */
export async function logAudit({
  action,
  severity = 'INFO',
  description,
  metadata,
}: AuditLogOptions) {
  try {
    const cleanMeta = sanitizeMetadata(metadata);
    return await prisma.auditLog.create({
      data: {
        action,
        severity,
        description,
        metadata: cleanMeta ? JSON.stringify(cleanMeta) : null,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
