'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity as ActivityIcon,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { Modal } from '@/components/Modal';

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async (page = 1) => {
    try {
      let url = `/api/activity?page=${page}&limit=${pagination.limit}&search=${encodeURIComponent(
        search
      )}`;
      if (actionFilter !== 'ALL') url += `&action=${actionFilter}`;
      if (severityFilter !== 'ALL') url += `&severity=${severityFilter}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [search, actionFilter, severityFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Activity & Audit Logs
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Immutable audit record of IP updates, authentication events, and provider operations.
          </p>
        </div>
        <button
          onClick={() => fetchLogs(pagination.page)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-[#0c1322] border border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs description..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Event Types</option>
            <option value="DNS_UPDATE">DNS Update</option>
            <option value="IP_CHANGE">IP Change</option>
            <option value="AUTH_LOGIN">Login Event</option>
            <option value="PROVIDER_CONNECT">Provider Connect</option>
            <option value="PROVIDER_ERROR">Provider Error</option>
            <option value="JOB_EXECUTE">Job Execution</option>
            <option value="SETTINGS_UPDATE">Settings Update</option>
          </select>
        </div>

        <div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Severities</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl bg-[#0c1322] border border-slate-800/80 shadow-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading audit logs...</div>
        ) : logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                          log.severity === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : log.severity === 'ERROR'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : log.severity === 'WARN'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            log.severity === 'SUCCESS'
                              ? 'bg-emerald-400'
                              : log.severity === 'ERROR'
                              ? 'bg-rose-400'
                              : log.severity === 'WARN'
                              ? 'bg-amber-400'
                              : 'bg-indigo-400'
                          }`}
                        />
                        <span>{log.severity}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-200">
                      {log.action}
                    </td>

                    <td className="py-3 px-4 max-w-md truncate text-slate-200 font-medium">
                      {log.description}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                        title="View Metadata"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-500">
            <ActivityIcon className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="font-semibold text-slate-300">No Logs Found</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Events will appear as actions occur across the dashboard and worker engine.
            </p>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-slate-800 text-xs text-slate-400">
            <div>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} events)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchLogs(pagination.page - 1)}
                className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLogs(pagination.page + 1)}
                className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Details"
        description="Structured telemetry record. Secrets are automatically sanitized."
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <span className="text-slate-500 text-[10px] block uppercase font-mono">
                  Event Action
                </span>
                <span className="font-mono text-white font-semibold">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block uppercase font-mono">
                  Severity
                </span>
                <span className="font-mono font-semibold text-indigo-400">
                  {selectedLog.severity}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 text-[10px] block uppercase font-mono">
                  Recorded At
                </span>
                <span className="font-mono text-slate-300">
                  {new Date(selectedLog.createdAt).toISOString()}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 font-medium block mb-1">Description</span>
              <p className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed font-sans">
                {selectedLog.description}
              </p>
            </div>

            {selectedLog.metadata && (
              <div>
                <span className="text-slate-400 font-medium block mb-1">Sanitized Metadata</span>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto max-h-48">
                  {JSON.stringify(JSON.parse(selectedLog.metadata), null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
