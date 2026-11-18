"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { api, formatDate, formatNumber } from "@/lib/api";
import type { ProcessingJob } from "@/types";
import { Database, CheckCircle2, AlertCircle, Clock3, LoaderCircle, ArrowRight, Activity } from "lucide-react";

function StatusPill({ status }: { status: ProcessingJob["status"] }) {
  const Icon = status === "completed" ? CheckCircle2 : status === "failed" ? AlertCircle : status === "processing" ? LoaderCircle : Clock3;
  return <span className={`pill ${status}`}><Icon size={12} className={status === "processing" ? "animate-spin" : ""} />{status}</span>;
}

export default function DataPipelinePage() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    try {
      const data = await api.jobs();
      setJobs(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void loadJobs();
    const interval = window.setInterval(() => void loadJobs(), 5000);
    return () => window.clearInterval(interval);
  }, [loadJobs]);

  const queued = jobs.filter((j) => j.status === "queued").length;
  const processing = jobs.filter((j) => j.status === "processing").length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed").length;

  return (
    <AppShell section="overview" pageName="Data Pipeline">
      <div className="content">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><Database size={13} /> Data infrastructure</div>
            <h1 className="page-title">Data Pipeline</h1>
            <p className="page-subtitle">Live view of all video analysis jobs flowing through the system.</p>
          </div>
        </div>

        <div className="metric-grid" style={{ marginBottom: 24 }}>
          <div className="metric-card">
            <div className="metric-top"><span className="metric-label">Queued</span><span className="metric-icon" style={{ color: "#b45309", background: "#fffbeb" }}><Clock3 size={17} /></span></div>
            <div className="metric-number">{queued}</div>
            <div className="metric-foot">Waiting for worker</div>
          </div>
          <div className="metric-card">
            <div className="metric-top"><span className="metric-label">Processing</span><span className="metric-icon" style={{ color: "#3867f5", background: "#eef2ff" }}><LoaderCircle size={17} /></span></div>
            <div className="metric-number">{processing}</div>
            <div className="metric-foot">Running now</div>
          </div>
          <div className="metric-card">
            <div className="metric-top"><span className="metric-label">Completed</span><span className="metric-icon" style={{ color: "#059669", background: "#ecfdf5" }}><CheckCircle2 size={17} /></span></div>
            <div className="metric-number">{completed}</div>
            <div className="metric-foot">Successfully processed</div>
          </div>
          <div className="metric-card">
            <div className="metric-top"><span className="metric-label">Failed</span><span className="metric-icon" style={{ color: "#dc2626", background: "#fef2f2" }}><AlertCircle size={17} /></span></div>
            <div className="metric-number">{failed}</div>
            <div className="metric-foot">Check worker logs</div>
          </div>
        </div>

        <section className="panel">
          <div className="panel-header">
            <div><h2 className="panel-title">All jobs</h2><div className="panel-description">Auto-refreshes every 5 seconds</div></div>
            <button className="btn-secondary" onClick={() => void loadJobs()}><Activity size={13} /> Refresh</button>
          </div>
          <div className="jobs-table-wrap">
            {loading ? (
              <div className="empty-state"><strong>Loading pipeline…</strong></div>
            ) : jobs.length === 0 ? (
              <div className="empty-state"><strong>No jobs yet</strong>Upload a video from the Overview page to start the pipeline.</div>
            ) : (
              <table className="jobs-table">
                <thead><tr><th>Video / Job</th><th>Status</th><th>Progress</th><th>Detections</th><th>Track IDs</th><th>Created</th><th /></tr></thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td><div className="file-cell"><div className="file-thumb"><Database size={14} /></div><div><div className="file-name">{job.filename}</div><div className="file-sub">ID {job.id.slice(0, 8)} · {job.stage}</div></div></div></td>
                      <td><StatusPill status={job.status} /></td>
                      <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1, background: "#e5ebf3", borderRadius: 99, height: 6, minWidth: 60 }}><div style={{ width: `${job.progress_percent}%`, background: job.status === "completed" ? "#20b486" : job.status === "failed" ? "#ef4444" : "#3867f5", height: "100%", borderRadius: 99, transition: "width .3s" }} /></div><span style={{ fontSize: 11, color: "#8d99aa" }}>{job.progress_percent}%</span></div></td>
                      <td style={{ fontWeight: 700, color: "#2d3f5b" }}>{formatNumber(job.detections_count)}</td>
                      <td>{formatNumber(job.unique_tracks_count)}</td>
                      <td>{formatDate(job.created_at)}</td>
                      <td><Link href={`/jobs/${job.id}`} className="table-link">Details <ArrowRight size={12} /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
