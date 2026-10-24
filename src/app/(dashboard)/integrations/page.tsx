'use client';

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Key,
  Lock,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ToastProvider';

export default function IntegrationsPage() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [connectedProviders, setConnectedProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Cloudflare Token Connect Modal
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [accountName, setAccountName] = useState('My Cloudflare Account');
  const [isVerifying, setIsVerifying] = useState(false);

  // Disconnect confirmation
  const [disconnectTarget, setDisconnectTarget] = useState<any | null>(null);

  const toast = useToast();

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.catalog || []);
        setConnectedProviders(data.connectedProviders || []);
      }
    } catch (err) {
      console.error('Error fetching providers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleConnectCloudflare = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);

    try {
      const res = await fetch('/api/providers/cloudflare/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiToken,
          name: accountName,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Cloudflare connected successfully!');
        setConnectModalOpen(false);
        setApiToken('');
        await fetchProviders();
      } else {
        toast.error(data.error || 'Connection failed.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect Cloudflare.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTestConnection = async (provider: any) => {
    toast.info(`Testing connection to ${provider.name}...`);
    try {
      const res = await fetch(`/api/providers/${provider.id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Connection healthy.');
        await fetchProviders();
      } else {
        toast.error(data.message || 'Connection test failed.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Test failed.');
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;
    try {
      const res = await fetch(`/api/providers/${disconnectTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Provider disconnected successfully.');
        setDisconnectTarget(null);
        await fetchProviders();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to disconnect provider.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Disconnection failed.');
    }
  };

  const cloudflareConnected = connectedProviders.find((p) => p.provider === 'cloudflare');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          DNS Provider Integrations
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Connect your authoritative DNS providers. Tokens are encrypted using AES-256-GCM at rest.
        </p>
      </div>

      {/* Grid of Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {catalog.map((provider) => {
          const isActiveProvider = provider.status === 'active';
          const isConnected = isActiveProvider && !!cloudflareConnected;

          return (
            <div
              key={provider.id}
              className={`p-6 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                isActiveProvider
                  ? 'bg-[#0c1322] border-slate-800 shadow-xl'
                  : 'bg-slate-900/30 border-slate-800/40 opacity-70 cursor-not-allowed'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{provider.name}</span>
                      {provider.website && provider.website !== '#' && (
                        <a
                          href={provider.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-500 hover:text-slate-300"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </h3>
                  </div>

                  {isActiveProvider ? (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        isConnected
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {isConnected ? 'CONNECTED' : 'AVAILABLE'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                      COMING SOON
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  {provider.description}
                </p>

                {isConnected && (
                  <div className="mt-4 p-3 rounded-xl bg-slate-900 border border-slate-800/80 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Account:</span>
                      <span className="text-slate-200 font-medium">{cloudflareConnected.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Zones:</span>
                      <span className="text-indigo-400 font-mono font-medium">
                        {cloudflareConnected._count?.zones || 0} zones imported
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Last Verified:</span>
                      <span>
                        {cloudflareConnected.lastVerifiedAt
                          ? new Date(cloudflareConnected.lastVerifiedAt).toLocaleDateString()
                          : 'Recent'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-800/60">
                {isActiveProvider ? (
                  isConnected ? (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleTestConnection(cloudflareConnected)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Test API</span>
                      </button>

                      <button
                        onClick={() => setConnectModalOpen(true)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                        title="Update API Token"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setDisconnectTarget(cloudflareConnected)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                        title="Disconnect Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConnectModalOpen(true)}
                      className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Connect Account</span>
                    </button>
                  )
                ) : (
                  <button
                    disabled
                    className="w-full py-2 px-4 rounded-xl bg-slate-800/40 border border-slate-800 text-slate-500 text-xs font-medium cursor-not-allowed"
                  >
                    Integration Inactive
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect Cloudflare Modal */}
      <Modal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        title="Connect Cloudflare Account"
        description="Provide a scoped API Token with Zone:Read and DNS:Edit permissions."
      >
        <form onSubmit={handleConnectCloudflare} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Account Label / Name
            </label>
            <input
              type="text"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Production Cloudflare"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Cloudflare Scoped API Token
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Paste scoped Cloudflare API token..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Create an API token in your Cloudflare dashboard with Template: <em>"Edit zone DNS"</em>.
              PulseDNS encrypts this token with AES-256-GCM before saving to disk.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Zero plaintext token exposure. Keys are never transmitted back to client browsers.</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setConnectModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
            >
              {isVerifying ? 'Verifying with Cloudflare...' : 'Verify & Connect'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Disconnect Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={handleDisconnect}
        title="Disconnect Cloudflare"
        message="Are you sure you want to disconnect this Cloudflare integration? Synced zones and DDNS jobs associated with this account will be halted."
        confirmLabel="Disconnect"
        isDestructive
      />
    </div>
  );
}
