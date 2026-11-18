"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import type { ProcessingJob } from "@/types";
import { Settings2, Cpu, Sliders, Database, Zap } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

export default function ConfigurationPage() {
  const [latestJob, setLatestJob] = useState<ProcessingJob | null>(null);

  useEffect(() => {
    void api.jobs().then((jobs) => {
      const done = jobs.find((j) => j.status === "completed");
      if (done) setLatestJob(done);
    }).catch(() => {});
  }, []);

  const summary = latestJob?.summary;

  const configRows = [
    { label: "YOLO Model", value: summary?.model ?? "yolov8n.pt", icon: <Cpu size={16} />, desc: "Object detection model weights" },
    { label: "Tracker", value: summary?.tracker ?? "bytetrack.yaml", icon: <Zap size={16} />, desc: "Multi-object tracking algorithm" },
    { label: "Confidence Threshold", value: summary?.confidence_threshold != null ? `${(summary.confidence_threshold * 100).toFixed(0)}%` : "25%", icon: <Sliders size={16} />, desc: "Minimum detection confidence" },
    { label: "Analysis Stride", value: summary?.analysis_stride_frames != null ? `Every ${summary.analysis_stride_frames} frames` : "Every 5 frames", icon: <Database size={16} />, desc: "DB sampling rate to reduce storage" },
    { label: "Max Video Length", value: "180 seconds", icon: <Zap size={16} />, desc: "Only first 3 minutes are analyzed" },
    { label: "Max Upload Size", value: "200 MB", icon: <Sliders size={16} />, desc: "Per-video file size limit" },
    { label: "API Endpoint", value: API_BASE_URL, icon: <Settings2 size={16} />, desc: "Backend FastAPI server" },
  ];

  return (
    <AppShell section="overview" pageName="Configuration">
      <div className="content">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><Settings2 size={13} /> System settings</div>
            <h1 className="page-title">Configuration</h1>
            <p className="page-subtitle">Current model and system settings detected from your running environment.</p>
          </div>
        </div>

        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header"><div><h2 className="panel-title">Model & inference settings</h2><div className="panel-description">{latestJob ? `Detected from job ${latestJob.id.slice(0, 8)}` : "Default values — process a video to detect live config"}</div></div></div>
          <div className="panel-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {configRows.map((row) => (
                <div key={row.label} style={{ background: "#f8fafc", border: "1px solid #e5ebf3", borderRadius: 14, padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, background: "#eef2ff", color: "#3867f5", borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0 }}>{row.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, color: "#8d99aa", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".6px" }}>{row.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2d47", wordBreak: "break-all" }}>{row.value}</div>
                    <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 4 }}>{row.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>


      </div>
    </AppShell>
  );
}
