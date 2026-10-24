'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Search,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/ToastProvider';
import Link from 'next/link';

export default function DomainsPage() {
  const [zones, setZones] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedZone, setSelectedZone] = useState<any | null>(null);
  const [zoneRecords, setZoneRecords] = useState<any[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const toast = useToast();

  const fetchZones = async () => {
    try {
      const res = await fetch(`/api/zones?search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setZones(data.zones || []);
      }
    } catch (err) {
      console.error('Error fetching zones:', err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, [search]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/zones', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Zones synchronized successfully.');
        await fetchZones();
      } else {
        toast.error(data.error || 'Failed to sync zones.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const openZoneDetails = async (zone: any) => {
    setSelectedZone(zone);
    setRecordsLoading(true);
    try {
      const res = await fetch(`/api/records?zoneId=${zone.id}`);
      if (res.ok) {
        const data = await res.json();
        setZoneRecords(data.records || []);
      }
    } catch (err) {
      console.error('Error fetching zone records:', err);
    } finally {
      setRecordsLoading(false);
    }
  };

  const filteredZones = zones.filter((z) => {
    if (statusFilter === 'ALL') return true;
    return z.status.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Domains & Zones
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage your Cloudflare authoritative DNS zones and domains.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>Sync from Cloudflare</span>
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-[#0c1322] border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domains..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 hidden sm:inline">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Zones Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredZones.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredZones.map((zone) => (
            <div
              key={zone.id}
              className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800/80 hover:border-slate-700 transition-all shadow-lg flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {zone.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-500">ID: {zone.zoneIdentifier.slice(0, 10)}...</span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      zone.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {zone.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800/60 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px]">Provider:</span>
                    <div className="font-medium text-slate-300 flex items-center gap-1 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>Cloudflare</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Managed Records:</span>
                    <div className="font-medium text-slate-200 mt-0.5">
                      {zone._count?.records || 0} Records
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                <button
                  onClick={() => openZoneDetails(zone)}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <span>View Records</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <Link
                  href={`/records?zoneId=${zone.id}`}
                  className="text-[11px] text-slate-500 hover:text-slate-300"
                >
                  Manage DDNS &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl bg-[#0c1322] border border-slate-800/80">
          <Globe className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No Domains Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {zones.length === 0
              ? 'Connect your Cloudflare account in Integrations or click "Sync from Cloudflare" to import your zones.'
              : 'No domains match your search query.'}
          </p>
          {zones.length === 0 && (
            <Link
              href="/integrations"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
            >
              <span>Connect Cloudflare Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* Zone Details Modal */}
      <Modal
        isOpen={!!selectedZone}
        onClose={() => setSelectedZone(null)}
        title={selectedZone ? `Zone: ${selectedZone.name}` : ''}
        description="Authoritative DNS records retrieved from Cloudflare."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span>Zone ID: {selectedZone?.zoneIdentifier}</span>
            <Link
              href={`/records?zoneId=${selectedZone?.id}`}
              className="text-indigo-400 hover:underline font-semibold"
            >
              Manage in DNS Records &rarr;
            </Link>
          </div>

          {recordsLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading DNS records...</div>
          ) : zoneRecords.length > 0 ? (
            <div className="divide-y divide-slate-800/60 max-h-80 overflow-y-auto pr-1">
              {zoneRecords.map((r) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-white flex items-center gap-2">
                      <span>{r.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {r.type}
                      </span>
                      {r.proxied && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Proxied
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-slate-400 text-[11px] mt-0.5">
                      Target: {r.content}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      r.isManaged
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {r.isManaged ? 'MANAGED' : 'UNMANAGED'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              No A or AAAA records found in this zone.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
