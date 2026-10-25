'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Layers,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Cloud,
  CloudOff,
  History,
  Trash2,
  Play,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ToastProvider';

export const dynamic = 'force-dynamic';

function RecordsPageContent() {
  const searchParams = useSearchParams();
  const initialZoneId = searchParams.get('zoneId') || '';

  const [records, setRecords] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState(initialZoneId);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [managedFilter, setManagedFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [historyModalRecord, setHistoryModalRecord] = useState<any | null>(null);
  const [recordHistory, setRecordHistory] = useState<any[]>([]);
  const [deleteDialogRecord, setDeleteDialogRecord] = useState<any | null>(null);
  const [deleteFromCloudflare, setDeleteFromCloudflare] = useState(false);

  // Create form state
  const [formZoneId, setFormZoneId] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'A' | 'AAAA'>('A');
  const [formContent, setFormContent] = useState('');
  const [formProxied, setFormProxied] = useState(false);
  const [formTtl, setFormTtl] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toast = useToast();

  const fetchRecords = async () => {
    try {
      let url = `/api/records?search=${encodeURIComponent(search)}`;
      if (selectedZone) url += `&zoneId=${encodeURIComponent(selectedZone)}`;
      if (typeFilter !== 'ALL') url += `&type=${typeFilter}`;
      if (managedFilter !== 'ALL') url += `&isManaged=${managedFilter === 'managed'}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchZones = async () => {
    try {
      const res = await fetch('/api/zones');
      if (res.ok) {
        const data = await res.json();
        setZones(data.zones || []);
        if (data.zones.length > 0 && !formZoneId) {
          setFormZoneId(data.zones[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching zones:', err);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [search, selectedZone, typeFilter, managedFilter]);

  const handleToggleManaged = async (record: any) => {
    try {
      const newStatus = !record.isManaged;
      const res = await fetch('/api/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          isManaged: newStatus,
        }),
      });

      if (res.ok) {
        toast.success(`Record ${record.name} is now ${newStatus ? 'Managed' : 'Unmanaged'}.`);
        await fetchRecords();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update record.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Update failed.');
    }
  };

  const handleManualUpdate = async (record: any) => {
    // If record has an associated job, trigger that job
    if (record.jobs && record.jobs.length > 0) {
      const jobId = record.jobs[0].id;
      try {
        const res = await fetch(`/api/jobs/${jobId}/run`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          toast.success(`DDNS run triggered: ${data.message}`);
          await fetchRecords();
        } else {
          toast.error(data.error || 'Failed to trigger DDNS run.');
        }
      } catch (err: any) {
        toast.error(err.message || 'Trigger failed.');
      }
    } else {
      toast.info('No DDNS job bound to this record. Create a job in DDNS Jobs page.');
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneId: formZoneId,
          name: formName,
          type: formType,
          content: formContent,
          proxied: formProxied,
          ttl: formTtl,
          isManaged: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`DNS record "${data.record.name}" created on Cloudflare!`);
        setCreateModalOpen(false);
        setFormName('');
        setFormContent('');
        await fetchRecords();
      } else {
        toast.error(data.error || 'Failed to create record.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Creation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!deleteDialogRecord) return;
    try {
      const res = await fetch(
        `/api/records?id=${deleteDialogRecord.id}&deleteFromProvider=${deleteFromCloudflare}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        toast.success(
          `Record "${deleteDialogRecord.name}" removed from dashboard${
            deleteFromCloudflare ? ' and deleted from Cloudflare' : ''
          }.`
        );
        setDeleteDialogRecord(null);
        await fetchRecords();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to delete record.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Deletion failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            DNS Records
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative A and AAAA records managed by PulseDNS automation.
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Managed Record</span>
        </button>
      </div>

      {/* Filter and search bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-2xl bg-[#0c1322] border border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hostnames..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Types (A & AAAA)</option>
            <option value="A">A Record (IPv4)</option>
            <option value="AAAA">AAAA Record (IPv6)</option>
          </select>
        </div>

        <div>
          <select
            value={managedFilter}
            onChange={(e) => setManagedFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Management States</option>
            <option value="managed">Managed Only</option>
            <option value="unmanaged">Unmanaged</option>
          </select>
        </div>
      </div>

      {/* Records Table */}
      <div className="rounded-2xl bg-[#0c1322] border border-slate-800/80 shadow-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading DNS records...</div>
        ) : records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">Hostname & Type</th>
                  <th className="py-3 px-4">Current DNS Target</th>
                  <th className="py-3 px-4">Cloudflare Proxy</th>
                  <th className="py-3 px-4">TTL</th>
                  <th className="py-3 px-4">Management Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{record.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {record.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Zone: {record.zone?.name || 'Unknown'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-200">
                      <div>{record.content}</div>
                      {record.lastDetectedIp && record.lastDetectedIp !== record.content && (
                        <div className="text-[10px] text-amber-400 font-sans mt-0.5">
                          Detected: {record.lastDetectedIp} (Pending update)
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {record.proxied ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Cloud className="w-3 h-3" />
                          <span>Proxied</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                          <CloudOff className="w-3 h-3" />
                          <span>DNS Only</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      {record.ttl === 1 ? 'Auto' : `${record.ttl}s`}
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleManaged(record)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold border transition-all ${
                          record.isManaged
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            record.isManaged ? 'bg-emerald-400' : 'bg-slate-500'
                          }`}
                        />
                        <span>{record.isManaged ? 'MANAGED' : 'UNMANAGED'}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {record.isManaged && (
                          <button
                            onClick={() => handleManualUpdate(record)}
                            title="Trigger Update Now"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setDeleteDialogRecord(record);
                            setDeleteFromCloudflare(false);
                          }}
                          title="Remove Record"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-500">
            <Layers className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="font-semibold text-slate-300">No DNS Records Found</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Click &quot;New Managed Record&quot; or synchronize zones from Cloudflare.
            </p>
          </div>
        )}
      </div>

      {/* Create Record Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Managed DNS Record"
        description="Creates an A or AAAA record on Cloudflare and tracks it in PulseDNS."
      >
        <form onSubmit={handleCreateRecord} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Authoritative DNS Zone
            </label>
            <select
              required
              value={formZoneId}
              onChange={(e) => setFormZoneId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Record Hostname
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="vpn.example.com or @"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as 'A' | 'AAAA')}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="A">A (IPv4)</option>
                <option value="AAAA">AAAA (IPv6)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Target IP Address
            </label>
            <input
              type="text"
              required
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder={formType === 'A' ? '198.51.100.1' : '2001:db8::1'}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="proxiedCheckbox"
              checked={formProxied}
              onChange={(e) => setFormProxied(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
            />
            <label htmlFor="proxiedCheckbox" className="text-xs text-slate-300 cursor-pointer">
              Enable Cloudflare Proxy (CDN, DDoS Protection)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Record Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteDialogRecord}
        onClose={() => setDeleteDialogRecord(null)}
        onConfirm={handleDeleteRecord}
        title="Remove Record"
        message={`Are you sure you want to remove "${deleteDialogRecord?.name}" from PulseDNS management?`}
        confirmLabel="Remove"
        isDestructive
      >
        <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300">
            <input
              type="checkbox"
              checked={deleteFromCloudflare}
              onChange={(e) => setDeleteFromCloudflare(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-rose-600"
            />
            <span>Also delete this record permanently from Cloudflare DNS</span>
          </label>
        </div>
      </ConfirmDialog>
    </div>
  );
}

export default function RecordsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-slate-400">Loading DNS records...</div>}>
      <RecordsPageContent />
    </Suspense>
  );
}
