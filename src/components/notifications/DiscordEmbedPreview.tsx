'use client';

import React, { useState } from 'react';
import { DISCORD_COLORS, formatIp } from '@/lib/notifications/embed-builder';
import { Eye, Shield, CheckCircle2, AlertTriangle, XCircle, Globe, RefreshCw, Radio, Server, BarChart3 } from 'lucide-react';

interface DiscordEmbedPreviewProps {
  botName?: string;
  avatarUrl?: string;
  timezone?: string;
  includeIpAddresses?: boolean;
}

type PreviewEventType =
  | 'PUBLIC_IP_CHANGED'
  | 'DNS_UPDATE_SUCCESS'
  | 'DNS_UPDATE_FAILED'
  | 'PROVIDER_CONNECTION_LOST'
  | 'PROVIDER_CONNECTION_RECOVERED'
  | 'AGENT_STATUS_CHANGED'
  | 'SYSTEM_STARTUP'
  | 'PERIODIC_SUMMARY';

export function DiscordEmbedPreview({
  botName = 'PulseDNS',
  avatarUrl,
  timezone = 'Asia/Ho_Chi_Minh',
  includeIpAddresses = true,
}: DiscordEmbedPreviewProps) {
  const [selectedEvent, setSelectedEvent] = useState<PreviewEventType>('PUBLIC_IP_CHANGED');

  const nowFormatted = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(new Date());

  const getEmbedData = () => {
    switch (selectedEvent) {
      case 'PUBLIC_IP_CHANGED':
        return {
          title: '🌐 Public IP Changed',
          description: 'A monitored public IP address has changed.',
          color: '#3498DB',
          colorInt: DISCORD_COLORS.BLUE,
          fields: [
            { name: 'Hostname / Domain', value: '`home.example.com`', inline: false },
            { name: 'Record', value: 'A', inline: true },
            { name: 'Previous IP', value: `\`${formatIp('203.0.113.10', includeIpAddresses)}\``, inline: true },
            { name: 'New IP', value: `\`${formatIp('203.0.113.20', includeIpAddresses)}\``, inline: true },
            { name: 'Source', value: 'SERVER_IP (api.ipify.org)', inline: true },
            { name: 'Event Time', value: nowFormatted, inline: false },
          ],
        };

      case 'DNS_UPDATE_SUCCESS':
        return {
          title: '✅ DNS Update Succeeded',
          description: 'Cloudflare DNS record has been successfully updated.',
          color: '#2ECC71',
          colorInt: DISCORD_COLORS.GREEN,
          fields: [
            { name: 'Hostname / Domain', value: '`nas.example.com`', inline: false },
            { name: 'Record', value: 'A', inline: true },
            { name: 'Previous DNS IP', value: `\`${formatIp('203.0.113.10', includeIpAddresses)}\``, inline: true },
            { name: 'New DNS IP', value: `\`${formatIp('203.0.113.20', includeIpAddresses)}\``, inline: true },
            { name: 'Provider', value: 'Cloudflare', inline: true },
            { name: 'Latency', value: '284 ms', inline: true },
            { name: 'Job', value: 'Home Server DDNS', inline: true },
            { name: 'Event Time', value: nowFormatted, inline: false },
          ],
        };

      case 'DNS_UPDATE_FAILED':
        return {
          title: '❌ DNS Update Failed',
          description: 'Failed to update DNS record on Cloudflare.',
          color: '#E74C3C',
          colorInt: DISCORD_COLORS.RED,
          fields: [
            { name: 'Hostname / Domain', value: '`vpn.example.com`', inline: false },
            { name: 'Record', value: 'AAAA', inline: true },
            { name: 'Error Category', value: 'Authentication Failure', inline: true },
            {
              name: 'Error Details',
              value: '```\nCloudflare API error: 9109 - Invalid access token provided\n```',
              inline: false,
            },
            { name: 'Attempt', value: '3', inline: true },
            { name: 'Job', value: 'Office Gateway IPv6', inline: true },
            { name: 'Event Time', value: nowFormatted, inline: false },
          ],
        };

      case 'PROVIDER_CONNECTION_LOST':
        return {
          title: '⚠️ Cloudflare Connection Lost',
          description: 'Unable to communicate with Cloudflare DNS API.',
          color: '#E74C3C',
          colorInt: DISCORD_COLORS.RED,
          fields: [
            { name: 'Provider', value: 'Cloudflare', inline: true },
            { name: 'Consecutive Failures', value: '3', inline: true },
            {
              name: 'Details',
              value: '```\nETIMEDOUT: Connection to api.cloudflare.com timed out after 10000ms\n```',
              inline: false,
            },
            { name: 'Event Time', value: nowFormatted, inline: false },
          ],
        };

      case 'PROVIDER_CONNECTION_RECOVERED':
        return {
          title: '🔄 Cloudflare Connection Recovered',
          description: 'Connection to Cloudflare DNS API has been restored.',
          color: '#2ECC71',
          colorInt: DISCORD_COLORS.GREEN,
          fields: [
            { name: 'Provider', value: 'Cloudflare', inline: true },
            { name: 'Outage Duration', value: '8m 42s', inline: true },
            { name: 'Event Time', value: nowFormatted, inline: false },
          ],
        };

      case 'AGENT_STATUS_CHANGED':
        return {
          title: '🟢 Remote Agent Reported New IP',
          description: 'Remote agent "homelab-worker-01" reported updated IP.',
          color: '#2ECC71',
          colorInt: DISCORD_COLORS.GREEN,
          fields: [
            { name: 'Agent', value: 'homelab-worker-01', inline: true },
            { name: 'Reported IP', value: `\`${formatIp('198.51.100.45', includeIpAddresses)}\``, inline: true },
            { name: 'Event Time', value: nowFormatted, inline: false },
          ],
        };

      case 'SYSTEM_STARTUP':
        return {
          title: '🚀 PulseDNS Services Started',
          description: 'PulseDNS background monitoring and DDNS scheduler are now running.',
          color: '#2ECC71',
          colorInt: DISCORD_COLORS.GREEN,
          fields: [
            { name: 'Environment', value: 'Production / Homelab', inline: true },
            { name: 'Worker', value: 'Active', inline: true },
            { name: 'Event Time', value: nowFormatted, inline: false },
          ],
        };

      case 'PERIODIC_SUMMARY':
        return {
          title: '📊 PulseDNS Status Digest',
          description: 'Periodic summary of DDNS monitoring activities.',
          color: '#9B59B6',
          colorInt: DISCORD_COLORS.PURPLE,
          fields: [
            { name: 'Managed Domains', value: '4', inline: true },
            { name: 'Active Jobs', value: '6', inline: true },
            { name: 'Successful Updates (24h)', value: '142', inline: true },
            { name: 'Failed Updates (24h)', value: '0', inline: true },
            { name: 'IP Changes Detected', value: '1', inline: true },
            { name: 'Provider Status', value: 'Cloudflare Connected', inline: true },
            { name: 'Event Time', value: nowFormatted, inline: false },
          ],
        };
    }
  };

  const embed = getEmbedData();

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-white text-base">Discord Embed Live Preview</h3>
          <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
            Mockup
          </span>
        </div>
      </div>

      {/* Event type tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-lg mb-5 overflow-x-auto">
        {[
          { id: 'PUBLIC_IP_CHANGED', label: 'IP Changed', icon: Globe },
          { id: 'DNS_UPDATE_SUCCESS', label: 'DNS Success', icon: CheckCircle2 },
          { id: 'DNS_UPDATE_FAILED', label: 'DNS Failed', icon: XCircle },
          { id: 'PROVIDER_CONNECTION_LOST', label: 'Outage', icon: AlertTriangle },
          { id: 'PROVIDER_CONNECTION_RECOVERED', label: 'Recovered', icon: RefreshCw },
          { id: 'AGENT_STATUS_CHANGED', label: 'Agent', icon: Radio },
          { id: 'SYSTEM_STARTUP', label: 'Startup', icon: Server },
          { id: 'PERIODIC_SUMMARY', label: 'Digest', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedEvent === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedEvent(tab.id as PreviewEventType)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Realistic Discord Client Message Viewport */}
      <div className="bg-[#313338] text-slate-200 rounded-lg p-4 font-sans border border-slate-700/50 shadow-inner select-none">
        {/* Message Header */}
        <div className="flex items-start gap-3">
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt={botName}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-slate-800"
              onError={(e) => {
                // Fallback to initial
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-sm flex-shrink-0 shadow">
              {botName ? botName.charAt(0).toUpperCase() : 'P'}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-semibold text-white text-sm hover:underline cursor-pointer">
                {botName || 'PulseDNS'}
              </span>
              <span className="bg-[#5865F2] text-white text-[10px] font-bold px-1 py-0.2 rounded uppercase tracking-wider">
                APP
              </span>
              <span className="text-[11px] text-slate-400">Today at 12:00 PM</span>
            </div>

            {/* Discord Embed Container */}
            <div
              className="bg-[#2B2D31] rounded p-3.5 max-w-xl border-l-4 shadow-sm"
              style={{ borderLeftColor: embed.color }}
            >
              {/* Embed Title */}
              <h4 className="font-semibold text-white text-base mb-1 hover:underline cursor-pointer">
                {embed.title}
              </h4>

              {/* Embed Description */}
              {embed.description && (
                <p className="text-sm text-slate-300 mb-3 whitespace-pre-wrap">
                  {embed.description}
                </p>
              )}

              {/* Embed Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                {embed.fields.map((f, i) => (
                  <div
                    key={i}
                    className={f.inline ? 'col-span-1' : 'col-span-1 sm:col-span-2'}
                  >
                    <div className="text-slate-400 font-semibold mb-0.5">{f.name}</div>
                    <div className="text-slate-200 break-words font-mono text-[11px]">
                      {f.value.startsWith('```') ? (
                        <pre className="bg-[#1E1F22] p-2 rounded text-[#DBDEE1] font-mono text-xs overflow-x-auto my-1 border border-slate-700/30">
                          {f.value.replace(/```/g, '').trim()}
                        </pre>
                      ) : (
                        <span>{f.value.replace(/`/g, '')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Embed Footer */}
              <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-2 border-t border-slate-700/40">
                <Shield className="w-3 h-3 text-slate-500" />
                <span>PulseDNS • DDNS Monitoring</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
