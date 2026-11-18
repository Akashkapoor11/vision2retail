"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  LoaderCircle,
  ScanEye,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ActivityChart, ClassCountChart } from "@/components/analytics-charts";
import { ApiError, api, apiMediaUrl, formatDate, formatDuration, formatNumber } from "@/lib/api";
import type { AnalyticsResponse, ProcessingJob } from "@/types";

function StatusPill({ status }: { status: ProcessingJob["status"] }) {
  const Icon = status === "completed" ? CheckCircle2 : status === "failed" ? AlertCircle : status === "processing" ? LoaderCircle : Clock3;
  return <span className={`pill ${status}`}><Icon size={12} className={status === "processing" ? "animate-spin" : ""} />{status}</span>;
}

function DetailStat({ label, value, foot }: { label: string; value: string; foot: string }) {
  return <div className="detail-stat"><div className="detail-stat-label">{label}</div><div className="detail-stat-value">{value}</div><div className="metric-foot">{foot}</div></div>;
}

export default function AnalysisDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [jobData, analyticsData] = await Promise.all([api.job(jobId), api.analytics(jobId)]);
      setJob(jobData);
      setAnalytics(analyticsData);
      setError("");
      setNotFound(false);
    } catch (caught) {
      setNotFound(caught instanceof ApiError && caught.status === 404);
      setError(caught instanceof Error ? caught.message : "Could not load the analysis job.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const isActive = job?.status === "queued" || job?.status === "processing";
  // Retry transient first-load/API errors; stop retrying for a genuine 404 or a settled job.
  const shouldPoll = !notFound && (!job || isActive || Boolean(error));

  useEffect(() => {
    void refresh();
    if (!shouldPoll) return;
    const interval = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(interval);
  }, [refresh, shouldPoll]);
  const classCounts = analytics?.summary?.sampled_detections_by_class ?? {};

  return (
    <AppShell section="analyses" pageName="Analysis report">
      <div className="content">
        <div style={{ marginBottom: 22 }}><Link href="/" className="table-link"><ArrowLeft size={14} /> Back to overview</Link></div>
        <div className="page-heading">
          <div>
            <div className="eyebrow"><ScanEye size={13} /> Video analysis report</div>
            <h1 className="page-title" style={{ overflowWrap: "anywhere" }}>{job?.filename ?? "Analysis details"}</h1>
            <p className="page-subtitle">Job ID {jobId} · Created {formatDate(job?.created_at ?? null)}</p>
          </div>
          {job && <StatusPill status={job.status} />}
        </div>

        {error && <div className="message error" role="alert"><AlertCircle size={14} style={{ verticalAlign: "middle", marginRight: 7 }} />{error}</div>}
        {loading && !job && <div className="skeleton" />}
        {isActive && job && <section className="panel" style={{ marginBottom: 20 }}><div className="panel-body">
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#314563", fontSize: 13, fontWeight: 750 }}><LoaderCircle size={17} className="animate-spin" color="#3867f5" />{job.stage}</div>
          <div className="progress-track" style={{ height: 7 }}><div className="progress-fill" style={{ width: `${Math.max(3, job.progress_percent)}%` }} /></div>
          <div className="metric-foot" style={{ marginTop: 9 }}>{job.progress_percent}% complete · {formatNumber(job.processed_frames)} of {formatNumber(job.total_frames)} frames processed. This page refreshes automatically.</div>
        </div></section>}

        {job?.status === "failed" && <div className="error-block" style={{ marginBottom: 20 }}><AlertCircle size={18} style={{ flexShrink: 0 }} /><div><strong>Analysis could not be completed</strong><div>{job.error_message || "The processing worker reported an unknown error."}</div><div style={{ marginTop: 5, color: "#ae6673" }}>Check that the video is valid and that the worker can download/load the configured model weights.</div></div></div>}

        {job && <>
          <div className="detail-grid primary-stats">
            <DetailStat label="Detections across frames" value={formatNumber(job.detections_count)} foot="Model output count; not unique objects" />
            <DetailStat label="Track IDs" value={formatNumber(job.unique_tracks_count)} foot="Tracker identifiers within this clip" />
            <DetailStat label="Peak estimated people" value={formatNumber(job.summary?.peak_estimated_people_in_frame)} foot="Highest per-frame estimate; not unique visitors" />
            <DetailStat label="Processing throughput" value={job.processing_fps ? `${job.processing_fps.toFixed(1)} FPS` : "—"} foot={`${formatDuration(job.duration_seconds)} source video analyzed`} />
          </div>

          {job.status === "completed" && <>
            <div className="detail-two-col">
              <section className="panel">
                <div className="panel-header"><div><h2 className="panel-title">Annotated video output</h2><div className="panel-description">YOLO detections with ByteTrack IDs where available</div></div>{job.has_annotated_video && <a className="table-link" href={apiMediaUrl(`/api/jobs/${job.id}/annotated-video`)} download><Download size={13} /> Download</a>}</div>
                <div className="panel-body">
                  {job.has_annotated_video ? <video className="video-preview" controls preload="metadata" src={apiMediaUrl(`/api/jobs/${job.id}/annotated-video`)} /> : <div className="empty-state"><strong>Annotated video unavailable</strong>The worker did not produce a playable output file.</div>}
                  <div className="detail-caption">Output contains the analyzed clip. Audio is not preserved in the processing pipeline. Confirm model labels visually before drawing conclusions.</div>
                </div>
              </section>
              <section className="panel">
                <div className="panel-header"><div><h2 className="panel-title">Person detection heatmap</h2><div className="panel-description">Density of sampled person-box centroids</div></div></div>
                <div className="panel-body">
                  {job.has_heatmap ? <img className="heatmap-preview" src={apiMediaUrl(`/api/jobs/${job.id}/heatmap`)} alt="Heatmap showing the concentration of sampled person detections" /> : <div className="empty-state"><strong>Heatmap unavailable</strong>No output image was generated.</div>}
                  <div className="detail-caption">The heatmap shows sampled detection-centre density—not a calibrated dwell-time measurement or a privacy-safe customer count.</div>
                </div>
              </section>
            </div>

            <div className="dashboard-grid">
              <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Activity over video time</h2><div className="panel-description">Estimated people per sampled frame and detection counts</div></div></div><div className="panel-body"><ActivityChart data={analytics?.timeline ?? []} /></div></section>
              <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Object-class breakdown</h2><div className="panel-description">Sampled-frame detections by model class</div></div></div><div className="panel-body"><ClassCountChart counts={classCounts} /></div></section>
            </div>

            <section className="panel" style={{ marginBottom: 18 }}>
              <div className="panel-header"><div><h2 className="panel-title">Longest observed tracks</h2><div className="panel-description">Top tracked IDs by number of observed frames (up to 100)</div></div></div>
              <div className="jobs-table-wrap"><table className="jobs-table"><thead><tr><th>Track ID</th><th>Class</th><th>First seen</th><th>Span (seconds)</th><th>Frames seen</th><th>Avg confidence</th></tr></thead><tbody>
                {(analytics?.tracks ?? []).length ? analytics!.tracks.map((track) => <tr key={`${track.class_name}-${track.track_id}`}><td style={{ color: "#2d3f5b", fontWeight: 750 }}>#{track.track_id}</td><td>{track.class_name}</td><td>{formatDuration(track.first_seen_seconds)}</td><td>{track.duration_seconds.toFixed(1)}s</td><td>{formatNumber(track.frames_seen)}</td><td>{(track.average_confidence * 100).toFixed(1)}%</td></tr>) : <tr><td colSpan={6}><div className="empty-state">No object track summaries were produced for this clip.</div></td></tr>}
              </tbody></table></div>
            </section>

            <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Reproducibility & interpretation</h2><div className="panel-description">Run configuration recorded with the result</div></div><ShieldCheck size={17} color="#3867f5" /></div><div className="panel-body" style={{ fontSize: 12, lineHeight: 1.75, color: "#718096" }}>
              <div className="detail-grid" style={{ marginTop: 0 }}>
                <DetailStat label="Model" value={analytics?.summary?.model ?? "—"} foot="Configured detector weights" />
                <DetailStat label="Tracker" value={analytics?.summary?.tracker ?? "—"} foot="Multi-object tracking backend" />
                <DetailStat label="Confidence threshold" value={analytics?.summary?.confidence_threshold == null ? "—" : `${Math.round(analytics.summary.confidence_threshold * 100)}%`} foot={`Persist every ${analytics?.summary?.analysis_stride_frames ?? "—"} frame(s) for analytics`} />
              </div>
              <p>{analytics?.summary?.metrics_note}</p><p>{analytics?.summary?.scope_note}</p>
              {analytics?.summary?.analyzed_first_seconds_only && <div className="message error">Only the first {analytics.summary.analyzed_first_seconds_only} seconds are configured to be analyzed for longer clips.</div>}
            </div></section>
          </>}
        </>}
        <footer className="footer"><span>Vision2Retail · Analysis detail</span><span>Results should be validated before operational use</span></footer>
      </div>
    </AppShell>
  );
}
