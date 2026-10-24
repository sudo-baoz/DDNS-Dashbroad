'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Globe,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Boxes,
  Wifi,
  Radio,
  RefreshCw,
  ArrowUpRight,
  TrendingUp,
  Activity as ActivityIcon,
  Server,
  Cloud,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useToast } from '@/components/ToastProvider';

export default function DashboardOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [ipData, setIpData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const loadData = async () => {
    try {
      const [statsRes, ipRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/ip/detect'),
      ]);

      if (statsRes.ok) {
        const stats = await statsRes.json();
        setData(stats);
      }
      if (ipRes.ok) {
        const ips = await ipRes.json();
        setIpData(ips);
      }
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    toast.info('Dashboard metrics updated.');
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-900 border border-slate-800 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-900 border border-slate-800 rounded-2xl" />
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const activityData = data?.activityData || [];
  const recentLogs = data?.recentActivity || [];

  return (
    <div className="space-y-8">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Operational Overview
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time dynamic DNS automation status and health metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/jobs"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all"
          >
            <span>Manage Jobs</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Managed Domains */}
        <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800/80 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Managed Domains</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {metrics.totalDomains ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <span>Connected via Cloudflare</span>
            </div>
          </div>
        </div>

        {/* Active DDNS Records */}
        <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800/80 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active DDNS Records</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {metrics.activeDDNSRecords ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="text-emerald-400 font-medium">{metrics.healthyRecords ?? 0} Healthy</span>
              <span>•</span>
              <span className={metrics.failedRecords > 0 ? 'text-rose-400 font-medium' : 'text-slate-500'}>
                {metrics.failedRecords ?? 0} Failed
              </span>
            </div>
          </div>
        </div>

        {/* Worker Status */}
        <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800/80 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">DDNS Engine</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-lg font-bold text-white tracking-tight uppercase">
                {metrics.workerStatus || 'Active'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              {metrics.nextScheduledCheck
                ? `Next check: ${new Date(metrics.nextScheduledCheck).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'Worker monitoring in background'}
            </div>
          </div>
        </div>

        {/* Connected Providers */}
        <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800/80 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Provider Status</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Cloud className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className={`text-base font-bold ${metrics.cloudflareStatus === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-400'}`}>
                {metrics.cloudflareStatus === 'CONNECTED' ? 'Cloudflare Active' : 'Not Connected'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              {metrics.lastSuccessfulUpdate
                ? `Last update: ${new Date(metrics.lastSuccessfulUpdate).toLocaleTimeString()}`
                : 'Ready for dynamic sync'}
            </div>
          </div>
        </div>
      </div>

      {/* Network & Live IP Detection Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-[#0c1322] border border-slate-800/80 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Public IP Telemetry</h3>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Server Mode
              </span>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Detected IPv4:</span>
                  {ipData?.ipv4LatencyMs !== undefined && (
                    <span className="font-mono text-[10px] text-slate-500">{ipData.ipv4LatencyMs}ms</span>
                  )}
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-sm text-white font-medium flex items-center justify-between">
                  <span>{ipData?.ipv4 || 'Detecting...'}</span>
                  {ipData?.ipv4Service && (
                    <span className="text-[10px] text-slate-500 font-sans truncate max-w-[130px]">
                      via {ipData.ipv4Service.replace('https://', '')}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Detected IPv6:</span>
                  {ipData?.ipv6LatencyMs !== undefined && (
                    <span className="font-mono text-[10px] text-slate-500">{ipData.ipv6LatencyMs}ms</span>
                  )}
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-sm text-slate-300 font-medium flex items-center justify-between">
                  <span className="truncate">{ipData?.ipv6 || 'No IPv6 detected'}</span>
                  {ipData?.ipv6Service && (
                    <span className="text-[10px] text-slate-500 font-sans truncate">
                      via {ipData.ipv6Service.replace('https://', '')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Remote Agent Support:</span>
            <Link href="/settings" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Configure Remote Mode &rarr;
            </Link>
          </div>
        </div>

        {/* Visualizations: DDNS Update Activity Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0c1322] border border-slate-800/80 shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">Update Activity History</h3>
            </div>
            <span className="text-xs text-slate-400">Last 24 Executions</span>
          </div>

          <div className="h-52 w-full mt-4">
            {activityData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={[0, 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#f8fafc',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="durationMs"
                    name="Latency (ms)"
                    stroke="#818cf8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSuccess)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <ActivityIcon className="w-8 h-8 mb-2 opacity-40 text-indigo-400" />
                <p className="text-xs">No DDNS job executions recorded yet.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Updates will plot automatically as scheduled checks run.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="p-6 rounded-2xl bg-[#0c1322] border border-slate-800/80 shadow-lg">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ActivityIcon className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Recent System Activity</h3>
          </div>
          <Link href="/activity" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
            View All Logs &rarr;
          </Link>
        </div>

        <div className="mt-4 divide-y divide-slate-800/60">
          {recentLogs.length > 0 ? (
            recentLogs.map((log: any) => (
              <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      log.severity === 'SUCCESS'
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                        : log.severity === 'ERROR'
                        ? 'bg-rose-400 shadow-[0_0_8px_#fb7185]'
                        : log.severity === 'WARN'
                        ? 'bg-amber-400'
                        : 'bg-indigo-400'
                    }`}
                  />
                  <div>
                    <div className="text-xs text-slate-200 font-medium">{log.description}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {log.action} • {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    log.severity === 'SUCCESS'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : log.severity === 'ERROR'
                      ? 'bg-rose-500/10 text-rose-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {log.severity}
                </span>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              No recent activity recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
