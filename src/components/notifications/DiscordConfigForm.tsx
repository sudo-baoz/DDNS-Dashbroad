'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RotateCw,
  Send,
  Save,
  Trash2,
  Key,
  Globe,
  Settings2,
  ShieldCheck,
  Eye,
  EyeOff,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface DiscordConfigFormProps {
  onConfigChange?: (config: {
    botName: string;
    avatarUrl: string;
    timezone: string;
    includeIpAddresses: boolean;
  }) => void;
}

const COMMON_TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (UTC+7)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
];

export function DiscordConfigForm({ onConfigChange }: DiscordConfigFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Stored state
  const [settings, setSettings] = useState<any>({});
  const [isConfigured, setIsConfigured] = useState(false);
  const [maskedUrl, setMaskedUrl] = useState('');

  // Form fields
  const [enabled, setEnabled] = useState(false);
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [isReplacingWebhook, setIsReplacingWebhook] = useState(false);
  const [botName, setBotName] = useState('PulseDNS');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [minSeverity, setMinSeverity] = useState('INFO');
  const [cooldownSeconds, setCooldownSeconds] = useState(60);
  const [errorThreshold, setErrorThreshold] = useState(1);
  const [includeIpAddresses, setIncludeIpAddresses] = useState(true);
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');

  // Quiet hours
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');

  // Periodic summary
  const [periodicSummaryEnabled, setPeriodicSummaryEnabled] = useState(false);
  const [periodicSummarySchedule, setPeriodicSummarySchedule] = useState('daily');

  // Event toggles
  const [notifyIpChange, setNotifyIpChange] = useState(true);
  const [notifyDnsSuccess, setNotifyDnsSuccess] = useState(true);
  const [notifyDnsFailure, setNotifyDnsFailure] = useState(true);
  const [notifyConnectionLost, setNotifyConnectionLost] = useState(true);
  const [notifyConnectionRecovered, setNotifyConnectionRecovered] = useState(true);
  const [notifyJobStatus, setNotifyJobStatus] = useState(true);
  const [notifyAgentStatus, setNotifyAgentStatus] = useState(true);
  const [notifySystemStartup, setNotifySystemStartup] = useState(false);

  // Modals
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const toast = useToast();

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/notifications/settings');
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || {};
        setSettings(s);
        setIsConfigured(Boolean(s.isConfigured));
        setMaskedUrl(s.webhookUrlMasked || '');

        setEnabled(Boolean(s.enabled));
        setBotName(s.botName || 'PulseDNS');
        setAvatarUrl(s.avatarUrl || '');
        setMinSeverity(s.minSeverity || 'INFO');
        setCooldownSeconds(s.cooldownSeconds ?? 60);
        setErrorThreshold(s.errorThreshold ?? 1);
        setIncludeIpAddresses(s.includeIpAddresses ?? true);
        setTimezone(s.timezone || 'Asia/Ho_Chi_Minh');

        setQuietHoursEnabled(Boolean(s.quietHoursEnabled));
        setQuietHoursStart(s.quietHoursStart || '22:00');
        setQuietHoursEnd(s.quietHoursEnd || '07:00');

        setPeriodicSummaryEnabled(Boolean(s.periodicSummaryEnabled));
        setPeriodicSummarySchedule(s.periodicSummarySchedule || 'daily');

        setNotifyIpChange(s.notifyIpChange ?? true);
        setNotifyDnsSuccess(s.notifyDnsSuccess ?? true);
        setNotifyDnsFailure(s.notifyDnsFailure ?? true);
        setNotifyConnectionLost(s.notifyConnectionLost ?? true);
        setNotifyConnectionRecovered(s.notifyConnectionRecovered ?? true);
        setNotifyJobStatus(s.notifyJobStatus ?? true);
        setNotifyAgentStatus(s.notifyAgentStatus ?? true);
        setNotifySystemStartup(s.notifySystemStartup ?? false);

        if (onConfigChange) {
          onConfigChange({
            botName: s.botName || 'PulseDNS',
            avatarUrl: s.avatarUrl || '',
            timezone: s.timezone || 'Asia/Ho_Chi_Minh',
            includeIpAddresses: s.includeIpAddresses ?? true,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load notification settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Sync live changes with parent preview
  useEffect(() => {
    if (onConfigChange) {
      onConfigChange({
        botName,
        avatarUrl,
        timezone,
        includeIpAddresses,
      });
    }
  }, [botName, avatarUrl, timezone, includeIpAddresses]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload: Record<string, any> = {
        enabled,
        botName,
        avatarUrl: avatarUrl.trim() || null,
        minSeverity,
        cooldownSeconds: Number(cooldownSeconds),
        errorThreshold: Number(errorThreshold),
        includeIpAddresses,
        timezone,
        quietHoursEnabled,
        quietHoursStart: quietHoursEnabled ? quietHoursStart : null,
        quietHoursEnd: quietHoursEnabled ? quietHoursEnd : null,
        periodicSummaryEnabled,
        periodicSummarySchedule,
        notifyIpChange,
        notifyDnsSuccess,
        notifyDnsFailure,
        notifyConnectionLost,
        notifyConnectionRecovered,
        notifyJobStatus,
        notifyAgentStatus,
        notifySystemStartup,
      };

      if (isReplacingWebhook || !isConfigured) {
        if (webhookUrlInput.trim()) {
          payload.webhookUrl = webhookUrlInput.trim();
        }
      }

      const res = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Discord notification settings saved.');
        setSettings(data.settings);
        setIsConfigured(Boolean(data.settings.isConfigured));
        setMaskedUrl(data.settings.webhookUrlMasked || '');
        setWebhookUrlInput('');
        setIsReplacingWebhook(false);
      } else {
        toast.error(data.error || 'Failed to save settings.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    setTesting(true);
    try {
      const payload: Record<string, any> = {};
      if (webhookUrlInput.trim()) {
        payload.webhookUrl = webhookUrlInput.trim();
      }

      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Test message delivered successfully to Discord!');
        setSettings((prev: any) => ({
          ...prev,
          deliveryStatus: 'CONNECTED',
          lastDeliveryError: null,
          lastDeliveryAt: new Date().toISOString(),
        }));
      } else {
        toast.error(data.error || 'Webhook test failed.');
        setSettings((prev: any) => ({
          ...prev,
          deliveryStatus: data.statusCode === 429 ? 'RATE_LIMITED' : data.isPermanentFailure ? 'INVALID_WEBHOOK' : 'DELIVERY_FAILED',
          lastDeliveryError: data.error || 'Webhook test failed.',
        }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Error testing webhook.');
    } finally {
      setTesting(false);
    }
  };

  const handleRemoveWebhook = async () => {
    try {
      const res = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeWebhook: true, enabled: false }),
      });

      if (res.ok) {
        toast.success('Discord Webhook removed.');
        setIsConfigured(false);
        setMaskedUrl('');
        setEnabled(false);
        setWebhookUrlInput('');
        setIsReplacingWebhook(false);
        setShowRemoveConfirm(false);
        loadSettings();
      } else {
        toast.error('Failed to remove webhook.');
      }
    } catch {
      toast.error('Error removing webhook.');
    }
  };

  const getStatusBadge = () => {
    if (!enabled) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
          Disabled
        </span>
      );
    }

    switch (settings.status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Connected
          </span>
        );
      case 'INVALID_WEBHOOK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Invalid Webhook
          </span>
        );
      case 'RATE_LIMITED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            Rate Limited
          </span>
        );
      case 'DELIVERY_FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Delivery Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Not Configured
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Integration Status Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#5865F2]/20 border border-[#5865F2]/30 flex items-center justify-center text-[#5865F2]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-base">Discord Webhook Integration</h3>
                {getStatusBadge()}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {settings.statusMessage ||
                  (isConfigured
                    ? 'Webhook is configured and ready for automated delivery.'
                    : 'Set up a Discord incoming webhook to receive real-time DDNS alerts.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestWebhook}
              disabled={testing || (!isConfigured && !webhookUrlInput.trim())}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Sending Test...' : 'Test Webhook'}
            </button>
          </div>
        </div>

        {/* Status Meta Info */}
        {(settings.lastTestedAt || settings.lastDeliveredAt || settings.lastFailedAt) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs">
            <div>
              <span className="text-slate-500 block">Last Tested</span>
              <span className="text-slate-300 font-mono">
                {settings.lastTestedAt ? new Date(settings.lastTestedAt).toLocaleString() : 'Never'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Last Delivered</span>
              <span className="text-emerald-400 font-mono">
                {settings.lastDeliveredAt ? new Date(settings.lastDeliveredAt).toLocaleString() : 'Never'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Last Failure</span>
              <span className="text-rose-400 font-mono">
                {settings.lastFailedAt ? new Date(settings.lastFailedAt).toLocaleString() : 'None'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Configuration Form */}
      <form onSubmit={handleSave} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-xl space-y-6">
        {/* Enable / Disable Switch */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <label className="font-semibold text-white text-sm block">Enable Discord Notifications</label>
            <span className="text-xs text-slate-400">
              When enabled, events will be queued and sent to your Discord channel.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              enabled ? 'bg-indigo-600' : 'bg-slate-800'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Discord Webhook URL */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Discord Webhook URL <span className="text-rose-400">*</span>
            </label>
            <a
              href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              How to get a Webhook URL <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {isConfigured && !isReplacingWebhook ? (
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <input
                type="text"
                readOnly
                value={maskedUrl}
                className="bg-transparent text-slate-300 text-xs font-mono w-full focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={() => setIsReplacingWebhook(true)}
                className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded whitespace-nowrap transition-all"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(true)}
                className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-all"
                title="Remove webhook"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://discord.com/api/webhooks/123456789012345678/abcdef..."
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
                {isReplacingWebhook && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsReplacingWebhook(false);
                      setWebhookUrlInput('');
                    }}
                    className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Must be an official Discord webhook endpoint starting with{' '}
                <code className="text-slate-400">https://discord.com/api/webhooks/</code>. Webhook credentials are encrypted with AES-256-GCM at rest.
              </p>
            </div>
          )}
        </div>

        {/* Bot Name & Avatar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Webhook Display Name
            </label>
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="PulseDNS"
              maxLength={32}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Custom Avatar URL (Optional)
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Event Triggers Checklist */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
            Active Notification Triggers
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              {
                id: 'ipChange',
                label: 'Public IP Changed',
                desc: 'When monitored public IP is detected changing',
                checked: notifyIpChange,
                set: setNotifyIpChange,
              },
              {
                id: 'dnsSuccess',
                label: 'DNS Update Succeeded',
                desc: 'When Cloudflare DNS record update succeeds',
                checked: notifyDnsSuccess,
                set: setNotifyDnsSuccess,
              },
              {
                id: 'dnsFailure',
                label: 'DNS Update Failed',
                desc: 'When Cloudflare DNS record update encounters errors',
                checked: notifyDnsFailure,
                set: setNotifyDnsFailure,
              },
              {
                id: 'connLost',
                label: 'Cloudflare Connection Lost',
                desc: 'When Cloudflare API is unreachable after failure threshold',
                checked: notifyConnectionLost,
                set: setNotifyConnectionLost,
              },
              {
                id: 'connRecovered',
                label: 'Cloudflare Connection Recovered',
                desc: 'When previously failed connection restores with duration',
                checked: notifyConnectionRecovered,
                set: setNotifyConnectionRecovered,
              },
              {
                id: 'jobStatus',
                label: 'DDNS Job Status Changed',
                desc: 'When jobs are paused, resumed, or status transitions',
                checked: notifyJobStatus,
                set: setNotifyJobStatus,
              },
              {
                id: 'agentStatus',
                label: 'Remote Agent Status',
                desc: 'When remote agent reports new IP or heartbeat alerts',
                checked: notifyAgentStatus,
                set: setNotifyAgentStatus,
              },
              {
                id: 'sysStartup',
                label: 'System Startup',
                desc: 'When PulseDNS services restart (cooldown protected)',
                checked: notifySystemStartup,
                set: setNotifySystemStartup,
              },
            ].map((item) => (
              <label
                key={item.id}
                className="flex items-start gap-2.5 p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg hover:border-slate-700 cursor-pointer transition-all"
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => item.set(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 bg-slate-900"
                />
                <div>
                  <div className="font-medium text-slate-200 text-xs">{item.label}</div>
                  <div className="text-[11px] text-slate-500">{item.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Anti-Spam, Cooldown & Security Controls */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
            Anti-Spam & Reliability Controls
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Minimum Severity</label>
              <select
                value={minSeverity}
                onChange={(e) => setMinSeverity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="INFO">INFO (All events)</option>
                <option value="WARN">WARN (Warnings & Errors)</option>
                <option value="ERROR">ERROR (Errors only)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Notification Cooldown</label>
              <select
                value={cooldownSeconds}
                onChange={(e) => setCooldownSeconds(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute (Default)</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
                <option value={1800}>30 minutes</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Outage Error Threshold</label>
              <select
                value={errorThreshold}
                onChange={(e) => setErrorThreshold(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={1}>1 failure (Immediate)</option>
                <option value={2}>2 consecutive failures</option>
                <option value={3}>3 consecutive failures</option>
                <option value={5}>5 consecutive failures</option>
              </select>
            </div>
          </div>
        </div>

        {/* Display Preferences & Timezone */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
            Display & Privacy Preferences
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Display Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <div>
                <span className="font-medium text-slate-200 text-xs block">Include IP Addresses</span>
                <span className="text-[11px] text-slate-500">
                  {includeIpAddresses ? 'Full IP addresses displayed in embed' : 'Masked (e.g. 203.0.***.***)'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={includeIpAddresses}
                onClick={() => setIncludeIpAddresses(!includeIpAddresses)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  includeIpAddresses ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    includeIpAddresses ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Quiet Hours & Periodic Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Quiet Hours Card */}
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-200 text-xs block">Quiet Hours</span>
                <span className="text-[11px] text-slate-500">Suppress non-critical alerts</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={quietHoursEnabled}
                onClick={() => setQuietHoursEnabled(!quietHoursEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  quietHoursEnabled ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    quietHoursEnabled ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {quietHoursEnabled && (
              <div className="flex items-center gap-2 pt-1 text-xs text-slate-300">
                <input
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs"
                />
              </div>
            )}
          </div>

          {/* Periodic Summary Card */}
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-200 text-xs block">Periodic Digest</span>
                <span className="text-[11px] text-slate-500">Send scheduled activity summaries</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={periodicSummaryEnabled}
                onClick={() => setPeriodicSummaryEnabled(!periodicSummaryEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  periodicSummaryEnabled ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    periodicSummaryEnabled ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {periodicSummaryEnabled && (
              <div className="pt-1">
                <select
                  value={periodicSummarySchedule}
                  onChange={(e) => setPeriodicSummarySchedule(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-full"
                >
                  <option value="daily">Daily Digest (Every 24h)</option>
                  <option value="weekly">Weekly Digest (Every 7 days)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Submit Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="text-xs text-slate-500">
            Homelab Mode: Anyone with access to this dashboard can manage notification destinations.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadSettings}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-all shadow-md shadow-indigo-600/20"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </form>

      {/* Remove Webhook Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRemoveConfirm}
        title="Remove Discord Webhook"
        message="Are you sure you want to remove the Discord Webhook integration? Notifications will be disabled."
        confirmLabel="Remove Webhook"
        isDestructive={true}
        onConfirm={handleRemoveWebhook}
        onClose={() => setShowRemoveConfirm(false)}
      />
    </div>
  );
}
