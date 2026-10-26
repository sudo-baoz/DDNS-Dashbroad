'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RotateCw,
  Info,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ToastProvider';

export function NotificationHistoryTable() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const toast = useToast();

  const loadHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });
      if (statusFilter) params.append('status', statusFilter);
      if (eventTypeFilter) params.append('eventType', eventTypeFilter);
      if (search) params.append('search', search);

      const res = await fetch(`/api/notifications/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.deliveries || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load notification history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [page, statusFilter, eventTypeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadHistory();
  };

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/notifications/history/${id}/retry`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success('Notification queued for immediate retry.');
        loadHistory();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to retry notification.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error retrying notification.');
    } finally {
      setRetryingId(null);
    }
  };

  const handleClearHistory = async () => {
    try {
      const res = await fetch('/api/notifications/history', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Notification history cleared.');
        setDeliveries([]);
        setTotal(0);
        setTotalPages(1);
        setShowClearConfirm(false);
      } else {
        toast.error('Failed to clear notification history.');
      }
    } catch {
      toast.error('Error clearing history.');
    }
  };

  const getStatusBadge = (status: string, attemptCount: number, maxAttempts: number) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Sent
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
      case 'SENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
            Sending
          </span>
        );
      case 'RETRYING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <RotateCw className="w-3.5 h-3.5" />
            Retrying ({attemptCount}/{maxAttempts})
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Failed ({attemptCount}/{maxAttempts})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            {status}
          </span>
        );
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'ERROR':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            ERROR
          </span>
        );
      case 'WARN':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            WARN
          </span>
        );
      case 'SUCCESS':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            SUCCESS
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            INFO
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-white text-base">Delivery History</h3>
          <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full">
            {total} events
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadHistory}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {total > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-medium transition-all"
              title="Clear all notification history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Log
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
        <form onSubmit={handleSearchSubmit} className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search domain, title, or error..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </form>

        <div className="md:col-span-4 flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="SENT">Sent</option>
            <option value="PENDING">Pending</option>
            <option value="RETRYING">Retrying</option>
            <option value="FAILED">Failed</option>
          </select>

          <select
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Event Types</option>
            <option value="PUBLIC_IP_CHANGED">IP Changed</option>
            <option value="DNS_UPDATE_SUCCESS">DNS Success</option>
            <option value="DNS_UPDATE_FAILED">DNS Failed</option>
            <option value="PROVIDER_CONNECTION_LOST">Connection Lost</option>
            <option value="PROVIDER_CONNECTION_RECOVERED">Connection Recovered</option>
            <option value="JOB_STATUS_CHANGED">Job Status</option>
            <option value="AGENT_STATUS_CHANGED">Agent Status</option>
            <option value="SYSTEM_STARTUP">System Startup</option>
            <option value="PERIODIC_SUMMARY">Status Digest</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Event / Title</th>
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <RotateCw className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Loading notification deliveries...</span>
                  </div>
                </td>
              </tr>
            ) : deliveries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No notification deliveries recorded yet.
                </td>
              </tr>
            ) : (
              deliveries.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-200">{item.title}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs">{item.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    {item.domain ? (
                      <span className="font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {item.domain}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{getSeverityBadge(item.severity)}</td>
                  <td className="px-4 py-3">
                    {getStatusBadge(item.status, item.attemptCount, item.maxAttempts)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {(item.status === 'FAILED' || item.status === 'RETRYING') && (
                      <button
                        type="button"
                        onClick={() => handleRetry(item.id)}
                        disabled={retryingId === item.id}
                        className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded text-xs transition-all"
                        title="Retry delivery now"
                      >
                        {retryingId === item.id ? (
                          <RotateCw className="w-3 h-3 animate-spin inline" />
                        ) : (
                          'Retry'
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-all"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
          <div>
            Showing page {page} of {totalPages} ({total} total records)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">{page}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedItem && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedItem(null)}
          title="Notification Delivery Details"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500 block">Event Type</span>
                <span className="font-mono text-slate-200 font-semibold">{selectedItem.eventType}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Severity</span>
                <span className="text-slate-200 font-semibold">{selectedItem.severity}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Delivery Status</span>
                <div>{getStatusBadge(selectedItem.status, selectedItem.attemptCount, selectedItem.maxAttempts)}</div>
              </div>
              <div>
                <span className="text-slate-500 block">Attempts</span>
                <span className="text-slate-200 font-mono">
                  {selectedItem.attemptCount} / {selectedItem.maxAttempts}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Created At</span>
                <span className="text-slate-200 font-mono">
                  {new Date(selectedItem.createdAt).toISOString()}
                </span>
              </div>
              {selectedItem.sentAt && (
                <div>
                  <span className="text-slate-500 block">Delivered At</span>
                  <span className="text-emerald-400 font-mono">
                    {new Date(selectedItem.sentAt).toISOString()}
                  </span>
                </div>
              )}
            </div>

            {selectedItem.lastError && (
              <div>
                <span className="text-rose-400 font-semibold block mb-1">Last Error Message</span>
                <pre className="bg-rose-950/30 text-rose-200 border border-rose-900/40 p-3 rounded-lg font-mono text-[11px] whitespace-pre-wrap">
                  {selectedItem.lastError}
                </pre>
              </div>
            )}

            <div>
              <span className="text-slate-400 font-semibold block mb-1">Title & Description</span>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="font-medium text-white mb-1">{selectedItem.title}</div>
                <div className="text-slate-300">{selectedItem.description}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              {(selectedItem.status === 'FAILED' || selectedItem.status === 'RETRYING') && (
                <button
                  type="button"
                  onClick={() => {
                    handleRetry(selectedItem.id);
                    setSelectedItem(null);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition-all"
                >
                  Retry Now
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Clear Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear Notification History"
        message="Are you sure you want to clear all notification delivery logs? This action cannot be undone."
        confirmLabel="Clear All Logs"
        isDestructive={true}
        onConfirm={handleClearHistory}
        onClose={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
