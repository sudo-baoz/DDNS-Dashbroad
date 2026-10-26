import {
  DiscordWebhookPayload,
  DeliveryResult,
  NotificationProvider,
} from './types';
import { validateDiscordWebhookUrl, sanitizeLogMessage } from './ssrf';

export class DiscordWebhookClient implements NotificationProvider {
  name = 'discord';

  validateUrl(url: string) {
    return validateDiscordWebhookUrl(url);
  }

  /**
   * Send a webhook message to Discord.
   * Handles 200/204 success, 429 rate limiting (Retry-After), 4xx permanent failure,
   * 5xx temporary failure, and network timeouts.
   */
  async send(
    webhookUrl: string,
    payload: DiscordWebhookPayload,
    options: { wait?: boolean; timeoutMs?: number } = {}
  ): Promise<DeliveryResult> {
    const validation = validateDiscordWebhookUrl(webhookUrl);
    if (!validation.valid || !validation.sanitizedUrl) {
      return {
        success: false,
        error: validation.reason || 'Invalid Discord Webhook URL.',
        isPermanentFailure: true,
      };
    }

    let targetUrl = validation.sanitizedUrl;
    if (options.wait) {
      targetUrl += '?wait=true';
    }

    const timeoutMs = options.timeoutMs || 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PulseDNS-DDNS-Dashboard/1.0 (+https://github.com/sudo-baoz/DDNS-Dashbroad)',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: 'error', // Prevent redirect-based SSRF
      });

      clearTimeout(timer);

      // Handle Success
      if (response.status === 200 || response.status === 204) {
        let messageId: string | undefined;
        if (response.status === 200) {
          try {
            const data = await response.json();
            messageId = data?.id;
          } catch {
            // ignore json parse if Discord returned empty body
          }
        }
        return {
          success: true,
          statusCode: response.status,
          messageId,
        };
      }

      // Handle Rate Limit (HTTP 429)
      if (response.status === 429) {
        let retryAfterMs = 5000;
        const retryHeader = response.headers.get('retry-after');
        if (retryHeader) {
          const parsedSec = parseFloat(retryHeader);
          if (!isNaN(parsedSec)) {
            retryAfterMs = Math.ceil(parsedSec * 1000);
          }
        }

        try {
          const body = await response.json();
          if (body?.retry_after) {
            const bodyMs = typeof body.retry_after === 'number'
              ? Math.ceil(body.retry_after * 1000)
              : parseInt(body.retry_after, 10);
            if (!isNaN(bodyMs) && bodyMs > 0) {
              retryAfterMs = bodyMs;
            }
          }
        } catch {
          // ignore
        }

        return {
          success: false,
          statusCode: 429,
          retryAfterMs,
          error: `Discord rate limited. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`,
          isPermanentFailure: false,
        };
      }

      // Read error body safely
      let errorBody = '';
      try {
        const json = await response.json();
        errorBody = json?.message || JSON.stringify(json);
      } catch {
        try {
          errorBody = await response.text();
        } catch {
          errorBody = 'Unknown HTTP error response';
        }
      }

      const sanitizedError = sanitizeLogMessage(errorBody);

      // Handle Permanent Failures (Invalid token, deleted webhook, bad request)
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return {
          success: false,
          statusCode: response.status,
          error: `Discord webhook authentication failed (${response.status}): ${sanitizedError}`,
          isPermanentFailure: true,
        };
      }

      if (response.status === 400) {
        return {
          success: false,
          statusCode: 400,
          error: `Discord rejected webhook payload (400 Bad Request): ${sanitizedError}`,
          isPermanentFailure: true,
        };
      }

      // 5xx and other temporary errors
      return {
        success: false,
        statusCode: response.status,
        error: `Discord server error (${response.status}): ${sanitizedError}`,
        isPermanentFailure: false,
      };
    } catch (err: any) {
      clearTimeout(timer);
      const isAbort = err.name === 'AbortError';
      const errMsg = isAbort
        ? `Request timed out after ${timeoutMs}ms.`
        : err.message || 'Network connection failed.';

      return {
        success: false,
        error: sanitizeLogMessage(errMsg),
        isPermanentFailure: false,
      };
    }
  }
}

export const discordClient = new DiscordWebhookClient();
