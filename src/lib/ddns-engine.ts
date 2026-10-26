import prisma from './prisma';
import { decryptText } from './crypto';
import { getProviderAdapter } from './providers/factory';
import { detectPublicIPv4, detectPublicIPv6, isValidIPv4, isValidIPv6 } from './ip-detector';
import { logAudit } from './audit';
import { notificationService, sanitizeLogMessage } from './notifications';

// Concurrency lock: set of active job IDs currently executing
const activeJobLocks = new Set<string>();

export interface JobExecutionResult {
  jobId: string;
  status: 'SUCCESS' | 'NO_CHANGE' | 'FAILED';
  detectedIp: string;
  previousIp?: string;
  message: string;
  durationMs: number;
}

function classifyErrorCategory(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('token') || lower.includes('auth') || lower.includes('401') || lower.includes('403')) {
    return 'Authentication Failure';
  }
  if (lower.includes('429') || lower.includes('rate limit')) {
    return 'Rate Limited';
  }
  if (lower.includes('timeout') || lower.includes('abort') || lower.includes('etimedout')) {
    return 'Network Timeout';
  }
  if (lower.includes('permission') || lower.includes('forbidden')) {
    return 'Missing DNS Permissions';
  }
  if (lower.includes('detect') || lower.includes('ipv4') || lower.includes('ipv6')) {
    return 'IP Detection Failure';
  }
  if (lower.includes('not found') || lower.includes('record')) {
    return 'Invalid DNS Record';
  }
  return 'Provider API Error';
}

function isProviderConnectionError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('etimedout') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('timeout') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('cloudflare api failure') ||
    lower.includes('network')
  );
}

/**
 * Execute a single DDNS job.
 * Handles concurrency locks, IP detection, DNS record comparison, safe API update, and history logging.
 */
export async function executeDDNSJob(
  jobId: string,
  options: { force?: boolean; explicitIp?: string } = {}
): Promise<JobExecutionResult> {
  // Prevent duplicate concurrent executions of the same job
  if (activeJobLocks.has(jobId)) {
    return {
      jobId,
      status: 'FAILED',
      detectedIp: '',
      message: 'Job is currently running in another execution thread. Skipped duplicate trigger.',
      durationMs: 0,
    };
  }

  activeJobLocks.add(jobId);
  const startTime = Date.now();

  try {
    const job = await prisma.ddnsJob.findUnique({
      where: { id: jobId },
      include: {
        record: {
          include: {
            zone: true,
            provider: true,
          },
        },
        remoteAgent: true,
      },
    });

    if (!job) {
      throw new Error(`DDNS Job ${jobId} not found.`);
    }

    if (!job.enabled && !options.force) {
      return {
        jobId,
        status: 'NO_CHANGE',
        detectedIp: '',
        message: 'Job is disabled.',
        durationMs: Date.now() - startTime,
      };
    }

    // 1. Determine Desired IP Address
    let detectedIp: string | null = null;
    let detectionSource = job.sourceMode;

    if (options.explicitIp) {
      detectedIp = options.explicitIp.trim();
    } else if (job.sourceMode === 'REMOTE_AGENT') {
      if (job.remoteAgent && job.remoteAgent.lastReportedIp) {
        detectedIp = job.remoteAgent.lastReportedIp;
      } else {
        throw new Error('Remote agent has not reported an IP address yet.');
      }
    } else {
      // SERVER_IP mode: detect public IP from server
      const settings = await prisma.applicationSettings.findUnique({ where: { id: 'default' } });
      const ipv4Urls = settings?.ipv4SourceUrls
        ? settings.ipv4SourceUrls.split(',').map((s) => s.trim())
        : undefined;
      const ipv6Urls = settings?.ipv6SourceUrls
        ? settings.ipv6SourceUrls.split(',').map((s) => s.trim())
        : undefined;

      if (job.ipVersion === 'IPv6') {
        const v6Result = await detectPublicIPv6(ipv6Urls, (settings?.requestTimeoutSec || 5) * 1000);
        if (!v6Result.ip) {
          throw new Error(`IPv6 detection failed: ${v6Result.error || 'No IPv6 address returned'}`);
        }
        detectedIp = v6Result.ip;
      } else {
        const v4Result = await detectPublicIPv4(ipv4Urls, (settings?.requestTimeoutSec || 5) * 1000);
        if (!v4Result.ip) {
          throw new Error(`IPv4 detection failed: ${v4Result.error || 'No IPv4 address returned'}`);
        }
        detectedIp = v4Result.ip;
      }
    }

    // 2. Validate IP Address matches job record family
    if (!detectedIp) {
      throw new Error('Unable to detect public IP address.');
    }

    if (job.ipVersion === 'IPv4' && !isValidIPv4(detectedIp)) {
      throw new Error(`Detected IP "${detectedIp}" is not a valid IPv4 address.`);
    }
    if (job.ipVersion === 'IPv6' && !isValidIPv6(detectedIp)) {
      throw new Error(`Detected IP "${detectedIp}" is not a valid IPv6 address.`);
    }

    const currentRecordContent = job.record.content;
    const isIpUnchanged = currentRecordContent.trim().toLowerCase() === detectedIp.trim().toLowerCase();

    // 3. If identical, record NO_CHANGE and skip calling provider API
    // (Never send notifications on unchanged IP during routine checks)
    if (isIpUnchanged && !options.force) {
      const durationMs = Date.now() - startTime;
      const nextRun = new Date(Date.now() + job.intervalSeconds * 1000);

      await prisma.$transaction([
        prisma.ddnsJob.update({
          where: { id: job.id },
          data: {
            status: 'SUCCESS',
            lastExecutionAt: new Date(),
            nextExecutionAt: nextRun,
            lastError: null,
          },
        }),
        prisma.ddnsExecution.create({
          data: {
            jobId: job.id,
            detectedIp,
            previousIp: currentRecordContent,
            status: 'NO_CHANGE',
            message: `Current IP matches DNS record (${detectedIp}). No API update required.`,
            durationMs,
          },
        }),
        prisma.dnsRecord.update({
          where: { id: job.record.id },
          data: {
            lastDetectedIp: detectedIp,
          },
        }),
      ]);

      return {
        jobId: job.id,
        status: 'NO_CHANGE',
        detectedIp,
        previousIp: currentRecordContent,
        message: 'IP address unchanged. Update omitted.',
        durationMs,
      };
    }

    // 4. IP changed: Notify Public IP Changed Event first
    notificationService.dispatch({
      type: 'PUBLIC_IP_CHANGED',
      severity: 'INFO',
      title: '🌐 Public IP Changed',
      description: `Public IP address changed for ${job.record.name}`,
      domain: job.record.name,
      jobId: job.id,
      jobName: job.name,
      recordType: job.record.type,
      previousIp: currentRecordContent,
      newIp: detectedIp,
      detectionSource: detectionSource,
      timestamp: new Date(),
    }).catch(() => {});

    // Decrypt credentials & call Provider Adapter
    const provider = job.record.provider;
    const credentials = JSON.parse(
      decryptText(provider.encryptedCredentials, provider.iv, provider.tag)
    );
    const adapter = getProviderAdapter(provider.provider);

    // Call updateRecord on Cloudflare / provider
    const updatedRecord = await adapter.updateRecord(
      credentials,
      job.record.zone.zoneIdentifier,
      job.record.recordIdentifier,
      {
        content: detectedIp,
        proxied: job.record.proxied,
        ttl: job.record.ttl,
      }
    );

    const durationMs = Date.now() - startTime;
    const nextRun = new Date(Date.now() + job.intervalSeconds * 1000);

    // 5. Persist success state, execution log, and IP history
    await prisma.$transaction([
      prisma.ddnsJob.update({
        where: { id: job.id },
        data: {
          status: 'SUCCESS',
          lastExecutionAt: new Date(),
          nextExecutionAt: nextRun,
          lastError: null,
        },
      }),
      prisma.dnsRecord.update({
        where: { id: job.record.id },
        data: {
          content: updatedRecord.content,
          lastDetectedIp: detectedIp,
          lastUpdatedAt: new Date(),
        },
      }),
      prisma.ddnsExecution.create({
        data: {
          jobId: job.id,
          detectedIp,
          previousIp: currentRecordContent,
          status: 'SUCCESS',
          message: `Successfully updated ${job.record.name} from ${currentRecordContent} to ${detectedIp}`,
          durationMs,
        },
      }),
      prisma.ipHistory.create({
        data: {
          recordId: job.record.id,
          oldIp: currentRecordContent,
          newIp: detectedIp,
          source: detectionSource,
        },
      }),
    ]);

    // Record structured audit log
    await logAudit({
      action: 'DNS_UPDATE',
      severity: 'SUCCESS',
      description: `Updated DNS record ${job.record.name} (${job.record.type}) to ${detectedIp}`,
      metadata: {
        jobName: job.name,
        recordName: job.record.name,
        oldIp: currentRecordContent,
        newIp: detectedIp,
        provider: provider.provider,
        durationMs,
      },
    });

    // Dispatch DNS_UPDATE_SUCCESS notification
    notificationService.dispatch({
      type: 'DNS_UPDATE_SUCCESS',
      severity: 'SUCCESS',
      title: '✅ DNS Update Succeeded',
      description: `Cloudflare DNS record updated to ${detectedIp}`,
      domain: job.record.name,
      jobId: job.id,
      jobName: job.name,
      recordType: job.record.type,
      previousIp: currentRecordContent,
      newIp: detectedIp,
      provider: provider.provider,
      latencyMs: durationMs,
      timestamp: new Date(),
    }).catch(() => {});

    // If Cloudflare connection was previously down, dispatch recovery
    notificationService.dispatch({
      type: 'PROVIDER_CONNECTION_RECOVERED',
      severity: 'SUCCESS',
      title: '🔄 Cloudflare Connection Recovered',
      description: 'Connection to Cloudflare has been restored.',
      provider: provider.provider,
      timestamp: new Date(),
    }).catch(() => {});

    return {
      jobId: job.id,
      status: 'SUCCESS',
      detectedIp,
      previousIp: currentRecordContent,
      message: `Updated DNS record to ${detectedIp}`,
      durationMs,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err.message || 'Unknown error occurred during DDNS update';

    // Persist failure state
    try {
      const job = await prisma.ddnsJob.findUnique({
        where: { id: jobId },
        include: { record: true },
      });

      if (job) {
        // Calculate retry backoff (e.g. interval or exponential backoff)
        const nextRetry = new Date(Date.now() + Math.min(job.intervalSeconds, 60) * 1000);

        await prisma.$transaction([
          prisma.ddnsJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              lastExecutionAt: new Date(),
              nextExecutionAt: nextRetry,
              lastError: errorMsg,
            },
          }),
          prisma.ddnsExecution.create({
            data: {
              jobId: job.id,
              detectedIp: 'N/A',
              status: 'FAILED',
              message: errorMsg,
              durationMs,
            },
          }),
        ]);

        await logAudit({
          action: 'DNS_UPDATE',
          severity: 'ERROR',
          description: `Failed DDNS update for job "${job.name}": ${errorMsg}`,
          metadata: {
            jobId: job.id,
            error: errorMsg,
          },
        });

        // Dispatch DNS_UPDATE_FAILED notification (sanitized of sensitive tokens)
        notificationService.dispatch({
          type: 'DNS_UPDATE_FAILED',
          severity: 'ERROR',
          title: '❌ DNS Update Failed',
          description: `Failed DDNS update for ${job.record?.name || job.name}`,
          domain: job.record?.name,
          jobId: job.id,
          jobName: job.name,
          recordType: job.record?.type,
          errorMessage: sanitizeLogMessage(errorMsg),
          errorCategory: classifyErrorCategory(errorMsg),
          timestamp: new Date(),
        }).catch(() => {});

        // If provider connection / network failed, dispatch PROVIDER_CONNECTION_LOST
        if (isProviderConnectionError(errorMsg)) {
          notificationService.dispatch({
            type: 'PROVIDER_CONNECTION_LOST',
            severity: 'ERROR',
            title: '⚠️ Cloudflare Connection Lost',
            description: 'Cloudflare connection lost or failing.',
            provider: 'Cloudflare',
            errorMessage: sanitizeLogMessage(errorMsg),
            timestamp: new Date(),
          }).catch(() => {});
        }
      }
    } catch (saveErr) {
      console.error('Failed to log job failure:', saveErr);
    }

    return {
      jobId,
      status: 'FAILED',
      detectedIp: '',
      message: errorMsg,
      durationMs,
    };
  } finally {
    activeJobLocks.delete(jobId);
  }
}

/**
 * Execute all enabled DDNS jobs that are due for execution.
 */
export async function runDueDDNSJobs(): Promise<JobExecutionResult[]> {
  const now = new Date();

  // Find enabled jobs whose nextExecutionAt is null or in the past
  const dueJobs = await prisma.ddnsJob.findMany({
    where: {
      enabled: true,
      OR: [
        { nextExecutionAt: null },
        { nextExecutionAt: { lte: now } },
      ],
    },
    select: { id: true },
  });

  const results: JobExecutionResult[] = [];
  for (const job of dueJobs) {
    const res = await executeDDNSJob(job.id);
    results.push(res);
  }

  return results;
}
