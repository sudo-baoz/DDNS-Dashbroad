'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Server,
  Radio,
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  Lock,
  RefreshCw,
  Terminal,
  Activity,
  Database,
  Cpu,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ToastProvider';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'ddns' | 'agents' | 'security' | 'system'>('general');
  const [settings, setSettings] = useState<any>({});
  const [system, setSystem] = useState<any>({});
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [dashboardName, setDashboardName] = useState('PulseDNS');
  const [timezone, setTimezone] = useState('UTC');
  const [defaultInterval, setDefaultInterval] = useState(300);
  const [ipv4SourceUrls, setIpv4SourceUrls] = useState('');
  const [ipv6SourceUrls, setIpv6SourceUrls] = useState('');
  const [requestTimeoutSec, setRequestTimeoutSec] = useState(10);
  const [maxRetries, setMaxRetries] = useState(3);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Agent Token Create Modal
  const [createAgentModal, setCreateAgentModal] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [revokeAgentTarget, setRevokeAgentTarget] = useState<any | null>(null);

  const toast = useToast();

  const loadSettings = async () => {
    try {
      const [setRes, agentRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/agent/tokens'),
      ]);

      if (setRes.ok) {
        const sData = await setRes.json();
        setSettings(sData.settings || {});
        setSystem(sData.system || {});
        setDashboardName(sData.settings.dashboardName || 'PulseDNS');
        setTimezone(sData.settings.timezone || 'UTC');
        setDefaultInterval(sData.settings.defaultInterval || 300);
        setIpv4SourceUrls(sData.settings.ipv4SourceUrls || '');
        setIpv6SourceUrls(sData.settings.ipv6SourceUrls || '');
        setRequestTimeoutSec(sData.settings.requestTimeoutSec || 10);
        setMaxRetries(sData.settings.maxRetries || 3);
      }

      if (agentRes.ok) {
        const aData = await agentRes.json();
        setAgents(aData.agents || []);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboardName,
          timezone,
        }),
      });

      if (res.ok) {
        toast.success('General settings saved.');
        await loadSettings();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save settings.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Save failed.');
    }
  };

  const handleSaveDDNS = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultInterval,
          ipv4SourceUrls,
          ipv6SourceUrls,
          requestTimeoutSec,
          maxRetries,
        }),
      });

      if (res.ok) {
        toast.success('DDNS Engine parameters updated.');
        await loadSettings();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save DDNS settings.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Save failed.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });

      if (res.ok) {
        toast.success('Administrator password changed successfully.');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Password update failed.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Password update failed.');
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/agent/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: agentName }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Agent "${data.agent.name}" generated.`);
        setGeneratedToken(data.token);
        await loadSettings();
      } else {
        toast.error(data.error || 'Failed to generate token.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create agent.');
    }
  };

  const handleRevokeAgent = async () => {
    if (!revokeAgentTarget) return;
    try {
      const res = await fetch(`/api/agent/tokens?id=${revokeAgentTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`Agent "${revokeAgentTarget.name}" revoked.`);
        setRevokeAgentTarget(null);
        await loadSettings();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to revoke token.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Revocation failed.');
    }
  };

  const copyToClipboard = (text: string, isSnippet = false) => {
    navigator.clipboard.writeText(text);
    if (isSnippet) {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
    toast.info('Copied to clipboard.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          Settings & Diagnostics
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure dynamic DNS update parameters, remote agent clients, security, and diagnostics.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-1 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'general', label: 'General', icon: Settings },
          { id: 'ddns', label: 'DDNS Engine', icon: Server },
          { id: 'agents', label: 'Remote Agents', icon: Radio },
          { id: 'security', label: 'Security & Auth', icon: Shield },
          { id: 'system', label: 'System Health', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: General */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="max-w-2xl space-y-4 p-6 rounded-2xl bg-[#0c1322] border border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Dashboard Name</label>
            <input
              type="text"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="America/New_York">America/New_York (EST/EDT)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (GMT+7)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Save Changes
            </button>
          </div>
        </form>
      )}

      {/* Tab: DDNS Engine */}
      {activeTab === 'ddns' && (
        <form onSubmit={handleSaveDDNS} className="max-w-2xl space-y-4 p-6 rounded-2xl bg-[#0c1322] border border-slate-800">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Default Check Interval (Seconds)
              </label>
              <input
                type="number"
                min={30}
                value={defaultInterval}
                onChange={(e) => setDefaultInterval(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Request Timeout (Seconds)
              </label>
              <input
                type="number"
                min={2}
                max={60}
                value={requestTimeoutSec}
                onChange={(e) => setRequestTimeoutSec(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Public IPv4 Fallback Detection Mirrors (Comma separated)
            </label>
            <textarea
              rows={2}
              value={ipv4SourceUrls}
              onChange={(e) => setIpv4SourceUrls(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Public IPv6 Fallback Detection Mirrors (Comma separated)
            </label>
            <textarea
              rows={2}
              value={ipv6SourceUrls}
              onChange={(e) => setIpv6SourceUrls(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Update DDNS Parameters
            </button>
          </div>
        </form>
      )}

      {/* Tab: Remote Agents */}
      {activeTab === 'agents' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-5 rounded-2xl bg-[#0c1322] border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Remote Agent Tokens</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                If PulseDNS is hosted on a remote VPS or cloud, configure a lightweight client on your home server or router to push its public IP here.
              </p>
            </div>
            <button
              onClick={() => {
                setGeneratedToken(null);
                setAgentName('');
                setCreateAgentModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate Token</span>
            </button>
          </div>

          {/* List of Agents */}
          <div className="rounded-2xl bg-[#0c1322] border border-slate-800 overflow-hidden">
            {agents.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Agent Name</th>
                    <th className="py-3 px-4">Last Reported IP</th>
                    <th className="py-3 px-4">Last Check-in</th>
                    <th className="py-3 px-4">Bound Jobs</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {agents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">{agent.name}</td>
                      <td className="py-3 px-4 font-mono text-cyan-400">
                        {agent.lastReportedIp || 'Never reported'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleString() : 'Never'}
                      </td>
                      <td className="py-3 px-4 font-mono">{agent._count?.jobs || 0}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setRevokeAgentTarget(agent)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Revoke Token"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                No remote agents created yet. Generate a token to connect a remote machine.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Security */}
      {activeTab === 'security' && (
        <form onSubmit={handleChangePassword} className="max-w-xl space-y-4 p-6 rounded-2xl bg-[#0c1322] border border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Change Master Password</h3>
            <p className="text-xs text-slate-400">Update your administrator password securely.</p>
          </div>

          <div className="pt-2 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">New Password (min 8 chars)</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Update Password
            </button>
          </div>
        </form>
      )}

      {/* Tab: System Health */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 font-bold text-white text-sm">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Runtime Engine Diagnostics</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Application Version:</span>
              <span className="font-mono text-white">PulseDNS v{system?.version || '1.0.0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Node.js Runtime:</span>
              <span className="font-mono text-white">{system?.nodeVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Host Platform:</span>
              <span className="font-mono text-white">{system?.platform}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Background Worker:</span>
              <span className="font-mono text-emerald-400 font-bold uppercase">{system?.workerStatus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Last Worker Heartbeat:</span>
              <span className="font-mono text-slate-300">
                {system?.lastHeartbeat ? new Date(system.lastHeartbeat).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 font-bold text-white text-sm">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>Data Persistence & Statistics</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Database Status:</span>
              <span className="font-mono text-emerald-400 font-bold uppercase">{system?.database}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Registered Zones:</span>
              <span className="font-mono text-white">{system?.stats?.zones || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Synchronized DNS Records:</span>
              <span className="font-mono text-white">{system?.stats?.records || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Configured DDNS Jobs:</span>
              <span className="font-mono text-white">{system?.stats?.jobs || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Lifetime Executions Logged:</span>
              <span className="font-mono text-indigo-400 font-bold">{system?.stats?.executions || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Generate Agent Token Modal */}
      <Modal
        isOpen={createAgentModal}
        onClose={() => setCreateAgentModal(false)}
        title={generatedToken ? 'Agent Token Created' : 'Generate Remote Agent Token'}
        description={
          generatedToken
            ? 'Copy your secret token now. It will not be shown again.'
            : 'Enter a label for this remote client machine.'
        }
        maxWidth="max-w-xl"
      >
        {generatedToken ? (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Bearer Token</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedToken}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-emerald-400"
                />
                <button
                  onClick={() => copyToClipboard(generatedToken)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1 font-semibold"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Example Cron / Curl Command</label>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 relative group">
                <code>
                  curl -X POST "{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/agent/update" \
                  {"\n"}  -H "Authorization: Bearer {generatedToken}"
                </code>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `curl -s -X POST "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/agent/update" -H "Authorization: Bearer ${generatedToken}"`,
                      true
                    )
                  }
                  className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                >
                  {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setCreateAgentModal(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateAgent} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Machine / Agent Name</label>
              <input
                type="text"
                required
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. Home Proxmox Server / Raspberry Pi"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCreateAgentModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Generate Token
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Revoke Agent Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!revokeAgentTarget}
        onClose={() => setRevokeAgentTarget(null)}
        onConfirm={handleRevokeAgent}
        title="Revoke Remote Agent"
        message={`Are you sure you want to revoke credentials for "${revokeAgentTarget?.name}"? Any cron or client reporting with this token will immediately be rejected.`}
        confirmLabel="Revoke"
        isDestructive
      />
    </div>
  );
}
