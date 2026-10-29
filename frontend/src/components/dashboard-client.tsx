"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileVideo,
  Layers3,
  LoaderCircle,
  ScanEye,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  Video,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ActivityChart, ClassCountChart } from "@/components/analytics-charts";
import { api, formatDate, formatNumber } from "@/lib/api";
import type { AnalyticsResponse, DashboardSummary, ProcessingJob } from "@/types";

function StatusPill({ status }: { status: ProcessingJob["status"] }) {
  const Icon = status === "completed" ? CheckCircle2 : status === "failed" ? AlertCircle : status === "processing" ? LoaderCircle : Clock3;
  return <span className={`pill ${status}`}><Icon size={12} className={status === "processing" ? "animate-spin" : ""} />{status}</span>;
}

function MetricCard({ label, value, sub, icon: Icon, color, background }: {
  label: string; value: string; sub: string; icon: LucideIcon; color: string; background: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className="metric-icon" style={{ color, background }}><Icon size={17} /></span>
      </div>
      <div className="metric-number">{value}</div>
      <div className="metric-foot"><ArrowUpRight size={12} /> {sub}</div>
    </div>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [latestTimeline, setLatestTimeline] = useState<AnalyticsResponse["timeline"]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [summaryData, jobsData] = await Promise.all([api.dashboardSummary(), api.jobs()]);
      setSummary(summaryData);
      setJobs(jobsData);
      setRefreshError("");
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "API could not be reached.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const interval = window.setInterval(() => void loadData(), 5000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  async function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setUploadError("Select a video file first.");
      return;
    }
    setUploading(true);
    setUploadError("");
    setUploadMessage("Uploading the video and adding it to the processing queue…");
    try {
      const job = await api.upload(selectedFile);
      setUploadMessage("Video accepted. Opening its live analysis status…");
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await loadData();
      router.push(`/jobs/${job.id}`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Check the API and try again.");
      setUploadMessage("");
    } finally {
      setUploading(false);
    }
  }

  const latestCompleted = jobs.find((job) => job.status === "completed");
  const latestCounts = latestCompleted?.summary?.sampled_detections_by_class ?? {};

  useEffect(() => {
    if (!latestCompleted?.id) return;
    let cancelled = false;
    void api.analytics(latestCompleted.id).then((data) => {
      if (!cancelled) setLatestTimeline(data.timeline);
    }).catch(() => { if (!cancelled) setLatestTimeline([]); });
    return () => { cancelled = true; };
  }, [latestCompleted?.id]);
  const defaultName = selectedFile?.name ?? "";

  return (
    <AppShell section="overview" pageName="Overview">
      <div className="content">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><Sparkles size={13} /> Computer vision workspace</div>
            <h1 className="page-title">Store intelligence, made visible.</h1>
            <p className="page-subtitle">Turn authorized store video into object tracks, sampled activity metrics and explainable visual evidence.</p>
          </div>
          <button className="btn-primary" onClick={() => fileInput.current?.click()} type="button">
            <UploadCloud size={15} /> Analyze a video
          </button>
        </div>

        {refreshError && <div className="message error" role="alert"><AlertCircle size={14} style={{ verticalAlign: "middle", marginRight: 7 }} />{refreshError} — make sure the API, database and worker services are running.</div>}

        <div className="metric-grid">
          <MetricCard label="Video analyses" value={loading && !summary ? "—" : formatNumber(summary?.jobs_total)} sub={`${formatNumber(summary?.jobs_completed)} completed`} icon={Video} color="#3867f5" background="#edf2ff" />
          <MetricCard label="Object detections" value={loading && !summary ? "—" : formatNumber(summary?.detections_total)} sub="Across completed videos" icon={ScanEye} color="#169d7b" background="#e6f8f1" />
          <MetricCard label="Tracked IDs" value={loading && !summary ? "—" : formatNumber(summary?.tracks_total)} sub="Within analyzed clips" icon={Layers3} color="#7655dc" background="#f0ebff" />
          <MetricCard label="Person track IDs" value={loading && !summary ? "—" : formatNumber(summary?.people_tracks_total)} sub="Not verified unique visitors" icon={Users} color="#bd821e" background="#fff5de" />
        </div>

        <div className="dashboard-grid">
          <section className="panel" id="platform">
            <div className="panel-header">
              <div><h2 className="panel-title">Latest completed analysis</h2><div className="panel-description">Sampled activity timeline from the most recent completed video</div></div>
              {latestCompleted && <Link className="table-link" href={`/jobs/${latestCompleted.id}`}>Open report <ArrowRight size={13} /></Link>}
            </div>
            <div className="panel-body">
              {latestCompleted ? <ActivityChart data={latestTimeline} /> : <div className="empty-state"><div className="upload-icon"><Activity size={18} /></div><strong>Your timeline will appear here</strong>Run your first video analysis to see estimated people per sampled frame and activity over time.</div>}
              <div className="chart-legend"><span><i className="legend-dot" style={{ background: "#3867f5" }} />Estimated people</span><span><i className="legend-dot" style={{ background: "#18a883" }} />Detections per sample</span></div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div><h2 className="panel-title">Analyze a store video</h2><div className="panel-description">Submit a clip to the computer-vision worker</div></div>
              <span style={{ color: "#9aa7b8" }}><FileVideo size={18} /></span>
            </div>
            <div className="panel-body">
              <form onSubmit={submitUpload}>
                <div className="upload-zone">
                  <div className="upload-icon"><UploadCloud size={19} /></div>
                  <div className="upload-title">{defaultName ? "Video selected" : "Choose a video to begin"}</div>
                  <div className="upload-copy">{defaultName || "MP4, MOV, AVI, MKV or WEBM. The API checks file size and queues processing in the background."}</div>
                  <label className="upload-file-label">
                    <Video size={13} /> Choose video
                    <input ref={fileInput} type="file" accept=".mp4,.mov,.avi,.mkv,.webm" hidden onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setUploadError(""); setUploadMessage(""); }} />
                  </label>
                  <div className="upload-meta">Local demo limit: 200 MB · First 180 seconds analyzed</div>
                </div>
                {uploading && <div className="progress-track"><div className="progress-fill progress-indeterminate" /></div>}
                {uploadError && <div className="message error" role="alert">{uploadError}</div>}
                {uploadMessage && <div className="message success" role="status">{uploadMessage}</div>}
                <button className="btn-primary" type="submit" disabled={uploading || !selectedFile} style={{ width: "100%", justifyContent: "center", marginTop: 13 }}>
                  {uploading ? <LoaderCircle className="animate-spin" size={15} /> : <ScanEye size={15} />}
                  {uploading ? "Submitting video…" : "Start analysis"}
                </button>
              </form>
              <div className="disclaimer" style={{ marginTop: 14 }}><ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} /><span>Use footage you are authorized to process. Person detections and track IDs do not establish identity or verified visitor counts.</span></div>
            </div>
          </section>
        </div>

        <section className="panel" id="recent-analyses">
          <div className="panel-header">
            <div><h2 className="panel-title">Recent video analyses</h2><div className="panel-description">Track status and open the evidence report for each run</div></div>
            <button className="btn-secondary" type="button" onClick={() => void loadData()}><Activity size={13} /> Refresh</button>
          </div>
          <div className="jobs-table-wrap">
            <table className="jobs-table">
              <thead><tr><th>Video / job</th><th>Status</th><th>Detections</th><th>Track IDs</th><th>Created</th><th /></tr></thead>
              <tbody>
                {jobs.length ? jobs.map((job) => (
                  <tr key={job.id}>
                    <td><div className="file-cell"><div className="file-thumb"><FileVideo size={16} /></div><div><div className="file-name">{job.filename}</div><div className="file-sub">ID {job.id.slice(0, 8)} · {job.stage}</div></div></div></td>
                    <td><StatusPill status={job.status} />{(job.status === "queued" || job.status === "processing") && <div style={{ fontSize: 9, color: "#8d99aa", marginTop: 5 }}>{job.progress_percent}%</div>}</td>
                    <td style={{ color: "#2d3f5b", fontWeight: 700 }}>{formatNumber(job.detections_count)}</td>
                    <td>{formatNumber(job.unique_tracks_count)}</td>
                    <td>{formatDate(job.created_at)}</td>
                    <td><Link href={`/jobs/${job.id}`} className="table-link">Details <ArrowRight size={12} /></Link></td>
                  </tr>
                )) : <tr><td colSpan={6}><div className="empty-state"><strong>No analyses yet</strong>Choose a store video above to create your first job.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {latestCompleted && <div className="dashboard-grid" style={{ marginTop: 18 }}>
          <section className="panel">
            <div className="panel-header"><div><h2 className="panel-title">Sampled object classes</h2><div className="panel-description">Detections recorded on sampled frames for the latest completed run</div></div></div>
            <div className="panel-body"><ClassCountChart counts={latestCounts} /></div>
          </section>
          <section className="panel">
            <div className="panel-header"><div><h2 className="panel-title">Analysis methodology</h2><div className="panel-description">What the current metrics mean</div></div><Sparkles size={17} color="#3867f5" /></div>
            <div className="panel-body" style={{ fontSize: 12, color: "#718096", lineHeight: 1.75 }}>
              <p style={{ marginTop: 0 }}><strong style={{ color: "#243650" }}>Detection count</strong> counts model detections across processed frames, not distinct objects.</p>
              <p><strong style={{ color: "#243650" }}>Track ID count</strong> counts tracker identifiers within this video. Occlusion and ID switches may affect the result.</p>
              <p><strong style={{ color: "#243650" }}>Class breakdown</strong> uses sampled frames to reduce database volume. Results depend on footage and the pretrained model.</p>
              <Link href={`/jobs/${latestCompleted.id}`} className="table-link">Review analysis evidence <ArrowRight size={13} /></Link>
            </div>
          </section>
        </div>}

        <div className="disclaimer"><AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /><span><strong>Interpretation note:</strong> This is a computer-vision demonstration. COCO-pretrained YOLOv8 classes are general object categories, not specialized retail behavior labels. Validate against a labeled dataset before using metrics for business decisions.</span></div>
        <footer className="footer"><span>Vision2Retail · AI-powered video intelligence</span><span>Python · FastAPI · YOLOv8 · PostgreSQL · Next.js</span></footer>
      </div>
    </AppShell>
  );
}
