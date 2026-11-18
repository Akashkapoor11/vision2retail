"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ClassCountChart, ActivityChart } from "@/components/analytics-charts";
import { api, formatNumber } from "@/lib/api";
import type { ProcessingJob, AnalyticsResponse } from "@/types";
import { BarChart3, TrendingUp, Users, ScanEye } from "lucide-react";

export default function RetailInsightsPage() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.jobs().then(async (j) => {
      setJobs(j);
      const completed = j.filter((job) => job.status === "completed");
      if (completed.length > 0) {
        try {
          const data = await api.analytics(completed[0].id);
          setAnalytics(data);
        } catch { /* ignore */ }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const completed = jobs.filter((j) => j.status === "completed");
  const totalDetections = completed.reduce((s, j) => s + j.detections_count, 0);
  const totalTracks = completed.reduce((s, j) => s + j.unique_tracks_count, 0);
  const totalPeople = completed.reduce((s, j) => s + j.person_tracks_count, 0);

  // Merge class counts across all completed jobs
  const mergedClasses: Record<string, number> = {};
  completed.forEach((j) => {
    Object.entries(j.summary?.sampled_detections_by_class ?? {}).forEach(([cls, count]) => {
      mergedClasses[cls] = (mergedClasses[cls] ?? 0) + count;
    });
  });

  return (
    <AppShell section="overview" pageName="Retail Insights">
      <div className="content">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><BarChart3 size={13} /> Retail analytics</div>
            <h1 className="page-title">Retail Insights</h1>
            <p className="page-subtitle">Aggregated intelligence across all your completed video analyses.</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><strong>Loading analytics…</strong></div>
        ) : completed.length === 0 ? (
          <div className="empty-state"><strong>No completed analyses yet</strong>Upload and process a store video to see retail insights here.</div>
        ) : (
          <>
            <div className="metric-grid" style={{ marginBottom: 24 }}>
              <div className="metric-card">
                <div className="metric-top"><span className="metric-label">Total Detections</span><span className="metric-icon" style={{ color: "#3867f5", background: "#eef2ff" }}><ScanEye size={17} /></span></div>
                <div className="metric-number">{formatNumber(totalDetections)}</div>
                <div className="metric-foot">Across {completed.length} completed {completed.length === 1 ? "video" : "videos"}</div>
              </div>
              <div className="metric-card">
                <div className="metric-top"><span className="metric-label">Total Track IDs</span><span className="metric-icon" style={{ color: "#7c3aed", background: "#f5f3ff" }}><TrendingUp size={17} /></span></div>
                <div className="metric-number">{formatNumber(totalTracks)}</div>
                <div className="metric-foot">Unique tracker identifiers</div>
              </div>
              <div className="metric-card">
                <div className="metric-top"><span className="metric-label">Person Tracks</span><span className="metric-icon" style={{ color: "#059669", background: "#ecfdf5" }}><Users size={17} /></span></div>
                <div className="metric-number">{formatNumber(totalPeople)}</div>
                <div className="metric-foot">Not verified unique visitors</div>
              </div>
            </div>

            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-header"><div><h2 className="panel-title">Object class breakdown</h2><div className="panel-description">Sampled detections across all completed analyses</div></div></div>
                <div className="panel-body"><ClassCountChart counts={mergedClasses} /></div>
              </section>
              {analytics && analytics.timeline.length > 0 && (
                <section className="panel">
                  <div className="panel-header"><div><h2 className="panel-title">Latest activity timeline</h2><div className="panel-description">Estimated people per sampled frame — most recent video</div></div></div>
                  <div className="panel-body"><ActivityChart data={analytics.timeline} /></div>
                </section>
              )}
            </div>

            <section className="panel" style={{ marginTop: 20 }}>
              <div className="panel-header"><div><h2 className="panel-title">Analysis history</h2><div className="panel-description">All completed video runs contributing to these insights</div></div></div>
              <div className="jobs-table-wrap">
                <table className="jobs-table">
                  <thead><tr><th>Video</th><th>Detections</th><th>Track IDs</th><th>Person Tracks</th><th>FPS</th></tr></thead>
                  <tbody>
                    {completed.map((j) => (
                      <tr key={j.id}>
                        <td><div className="file-name">{j.filename}</div><div className="file-sub">{j.duration_seconds}s · {j.width}×{j.height}</div></td>
                        <td style={{ fontWeight: 700, color: "#2d3f5b" }}>{formatNumber(j.detections_count)}</td>
                        <td>{formatNumber(j.unique_tracks_count)}</td>
                        <td>{formatNumber(j.person_tracks_count)}</td>
                        <td>{j.processing_fps ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
