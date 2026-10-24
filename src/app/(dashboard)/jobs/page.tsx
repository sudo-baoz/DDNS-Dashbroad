'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Pause,
  Server,
  Radio,
  History,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ToastProvider';

export default function DDNSJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [historyModalJob, setHistoryModalJob] = useState<any | null>(null);
  const [jobExecutions, setJobExecutions] = useState<any[]>([]);
  const [deleteJobTarget, setDeleteJobTarget] = useState<any | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formRecordId, setFormRecordId] = useState('');
  const [formIpVersion, setFormIpVersion] = useState<'IPv4' | 'IPv6'>('IPv4');
  const [formSourceMode, setFormSourceMode] = useState<'SERVER_IP' | 'REMOTE_AGENT'>('SERVER_IP');
  const [formAgentId, setFormAgentId] = useState('');
  const [formInterval, setFormInterval] = useState(300);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toast = useToast();

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrerequisites = async () => {
    try {
      const [recRes, agentRes] = await Promise.all([
        fetch('/api/records'),
        fetch('/api/agent/tokens'),
      ]);

      if (recRes.ok) {
        const rData = await recRes.json();
        setRecords(rData.records || []);
        if (rData.records.length > 0 && !formRecordId) {
          setFormRecordId(rData.records[0].id);
        }
      }

      if (agentRes.ok) {
        const aData = await agentRes.json();
        setAgents(aData.agents || []);
        if (aData.agents.length > 0 && !formAgentId) {
          setFormAgentId(aData.agents[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching prerequisites:', err);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchPrerequisites();
  }, []);

  const handleToggleJob = async (job: any) => {
    try {
      const newEnabled = !job.enabled;
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });

      if (res.ok) {
        toast.success(`Job "${job.name}" is now ${newEnabled ? 'Enabled' : 'Paused'}.`);
        await fetchJobs();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update job.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Update failed.');
    }
  };

  const handleRunNow = async (job: any) => {
    toast.info(`Triggering execution for "${job.name}"...`);
    try {
      const res = await fetch(`/api/jobs/${job.id}/run`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'SUCCESS') {
          toast.success(`Updated DNS: ${data.message}`);
        } else if (data.status === 'NO_CHANGE') {
          toast.info(`No update needed: ${data.message}`);
        } else {
          toast.error(`Update failed: ${data.message}`);
        }
        await fetchJobs();
      } else {
        toast.error(data.error || 'Execution failed.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Run failed.');
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          recordId: formRecordId,
          ipVersion: formIpVersion,
          sourceMode: formSourceMode,
          remoteAgentId: formSourceMode === 'REMOTE_AGENT' ? formAgentId : undefined,
          intervalSeconds: formInterval,
          enabled: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`DDNS Job "${data.job.name}" created!`);
        setCreateModalOpen(false);
        setFormName('');
        await fetchJobs();
      } else {
        toast.error(data.error || 'Failed to create job.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Creation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteJobTarget) return;
    try {
      const res = await fetch(`/api/jobs/${deleteJobTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`Job "${deleteJobTarget.name}" deleted.`);
        setDeleteJobTarget(null);
        await fetchJobs();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to delete job.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Deletion failed.');
    }
  };

  const openHistory = async (job: any) => {
    setHistoryModalJob(job);
    try {
      const res = await fetch(`/api/jobs/${job.id}`);
      if (res.ok) {
        const data = await res.json();
        setJobExecutions(data.job.executions || []);
      }
    } catch {
      // Ignored
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            DDNS Jobs
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Scheduled Dynamic DNS update jobs running independently 24/7.
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create DDNS Job</span>
        </button>
      </div>

      {/* Jobs Grid / List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading DDNS jobs...</div>
        ) : jobs.length > 0 ? (
          jobs.map((job) => (
            <div
              key={job.id}
              className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800/80 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-700 transition-all"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-2xl shrink-0 mt-0.5 ${
                    job.status === 'SUCCESS'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : job.status === 'FAILED'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-white">{job.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                      {job.ipVersion}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        job.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {job.enabled ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 flex-wrap">
                    <div>
                      <span className="text-slate-500">Record: </span>
                      <span className="font-mono text-slate-200 font-medium">
                        {job.record?.name || 'Unknown'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500">Source: </span>
                      <span className="text-slate-300 font-medium">
                        {job.sourceMode === 'SERVER_IP'
                          ? 'Server Outbound IP'
                          : `Remote Agent (${job.remoteAgent?.name || 'Agent'})`}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500">Interval: </span>
                      <span className="font-mono text-slate-300">
                        {job.intervalSeconds >= 60
                          ? `${job.intervalSeconds / 60}m`
                          : `${job.intervalSeconds}s`}
                      </span>
                    </div>
                  </div>

                  {job.lastError && (
                    <div className="text-[11px] text-rose-400 mt-2 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{job.lastError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Right */}
              <div className="flex items-center gap-2 self-end md:self-center">
                <button
                  onClick={() => openHistory(job)}
                  title="Execution History"
                  className="p-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <History className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleToggleJob(job)}
                  title={job.enabled ? 'Pause Job' : 'Resume Job'}
                  className="p-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                >
                  {job.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => handleRunNow(job)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Now</span>
                </button>

                <button
                  onClick={() => setDeleteJobTarget(job)}
                  title="Delete Job"
                  className="p-2 rounded-xl border border-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center rounded-2xl bg-[#0c1322] border border-slate-800/80">
            <Clock className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="font-semibold text-slate-300">No DDNS Jobs Configured</p>
            <p className="text-xs text-slate-500 mt-1">
              Create an automated job to periodically check and sync your public IP with Cloudflare.
            </p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Create First Job
            </button>
          </div>
        )}
      </div>

      {/* Create Job Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Automated DDNS Job"
        description="Configure continuous background dynamic DNS synchronization."
      >
        <form onSubmit={handleCreateJob} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Job Name</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Home Server Dynamic IPv4"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Target DNS Record</label>
            <select
              required
              value={formRecordId}
              onChange={(e) => setFormRecordId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.type}) — {r.content}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">IP Protocol</label>
              <select
                value={formIpVersion}
                onChange={(e) => setFormIpVersion(e.target.value as 'IPv4' | 'IPv6')}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="IPv4">IPv4 (A Record)</option>
                <option value="IPv6">IPv6 (AAAA Record)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Check Interval</label>
              <select
                value={formInterval}
                onChange={(e) => setFormInterval(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={60}>Every 1 minute</option>
                <option value={300}>Every 5 minutes (Recommended)</option>
                <option value={900}>Every 15 minutes</option>
                <option value={1800}>Every 30 minutes</option>
                <option value={3600}>Every 1 hour</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">IP Detection Source</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormSourceMode('SERVER_IP')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formSourceMode === 'SERVER_IP'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-semibold text-xs flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Server Public IP</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Worker detects the public IP from this dashboard host.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormSourceMode('REMOTE_AGENT')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formSourceMode === 'REMOTE_AGENT'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-semibold text-xs flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Remote Agent / Client</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Home server or client reports its IP via secure token.
                </div>
              </button>
            </div>
          </div>

          {formSourceMode === 'REMOTE_AGENT' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Select Remote Agent
              </label>
              {agents.length > 0 ? (
                <select
                  value={formAgentId}
                  onChange={(e) => setFormAgentId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Last IP: {a.lastReportedIp || 'Never reported'})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                  No remote agents created yet. Generate an agent token in Settings &rarr; Remote Agents.
                </div>
              )}
            </div>
          )}

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
              {isSubmitting ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={!!historyModalJob}
        onClose={() => setHistoryModalJob(null)}
        title={historyModalJob ? `Execution History: ${historyModalJob.name}` : ''}
        description="Recent execution checks and DNS updates for this job."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1 divide-y divide-slate-800/60">
          {jobExecutions.length > 0 ? (
            jobExecutions.map((exec) => (
              <div key={exec.id} className="pt-2.5 first:pt-0 flex items-start justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        exec.status === 'SUCCESS'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : exec.status === 'NO_CHANGE'
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {exec.status}
                    </span>
                    <span className="font-mono text-slate-300">
                      IP: {exec.detectedIp || 'N/A'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {exec.message}
                  </div>
                </div>
                <div className="text-right text-[10px] font-mono text-slate-500 shrink-0">
                  <div>{new Date(exec.executedAt).toLocaleTimeString()}</div>
                  <div className="mt-0.5">{exec.durationMs}ms</div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              No executions logged for this job yet.
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteJobTarget}
        onClose={() => setDeleteJobTarget(null)}
        onConfirm={handleDeleteJob}
        title="Delete DDNS Job"
        message={`Are you sure you want to delete the job "${deleteJobTarget?.name}"? Scheduled checks will stop immediately.`}
        confirmLabel="Delete Job"
        isDestructive
      />
    </div>
  );
}
