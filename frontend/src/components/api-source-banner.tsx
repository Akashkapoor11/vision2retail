"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FlaskConical, Server } from "lucide-react";
import { getApiSourceMode, subscribeApiSource, type ApiSourceMode } from "@/lib/api";

type SourceState = { mode: ApiSourceMode; message: string };

export function ApiSourceBanner() {
  const [source, setSource] = useState<SourceState | null>(null);

  useEffect(() => {
    // Read module state as well as subscribing, so an early request event isn't missed.
    const initial = getApiSourceMode();
    if (initial === "secondary") setSource({ mode: initial, message: "Primary API unavailable. Using the configured secondary API." });
    if (initial === "demo") setSource({ mode: initial, message: "Live APIs unavailable. Synthetic sample data only; uploads and analysis require a live API." });
    return subscribeApiSource(setSource);
  }, []);

  if (!source || source.mode === "primary") return null;
  if (source.mode === "secondary") {
    return <div className="data-source-banner secondary" role="status"><Server size={15} /><span><strong>Secondary API</strong> — {source.message}</span></div>;
  }
  return <div className="data-source-banner demo" role="status"><FlaskConical size={15} /><span><strong>DEMO / SAMPLE DATA</strong> — {source.message} These values are illustrative, not actual store measurements.</span><AlertTriangle size={15} /></div>;
}
