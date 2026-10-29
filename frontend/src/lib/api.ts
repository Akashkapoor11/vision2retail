import type { AnalyticsResponse, DashboardSummary, ProcessingJob } from "@/types";
import { DEMO_JOBS, DEMO_SUMMARY, getDemoAnalytics, getDemoJob } from "@/lib/demo-data";

/** Primary live backend. All application data requests go through this API first. */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
/** Optional second live backend used only for safe GET/read requests. */
export const API_FALLBACK_URL = (process.env.NEXT_PUBLIC_API_FALLBACK_URL || "").replace(/\/$/, "");

export type ApiSourceMode = "primary" | "secondary" | "demo";
let currentSourceMode: ApiSourceMode = "primary";
const SOURCE_EVENT = "vision2retail:api-source";

type SourceEvent = { mode: ApiSourceMode; message: string };

function setSourceMode(mode: ApiSourceMode, message: string): void {
  currentSourceMode = mode;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<SourceEvent>(SOURCE_EVENT, { detail: { mode, message } }));
  }
}

export function getApiSourceMode(): ApiSourceMode {
  return currentSourceMode;
}

export function subscribeApiSource(listener: (detail: SourceEvent) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => listener((event as CustomEvent<SourceEvent>).detail);
  window.addEventListener(SOURCE_EVENT, handler);
  return () => window.removeEventListener(SOURCE_EVENT, handler);
}

/** Select the same live API host that supplied the latest successful read. */
export function apiMediaUrl(path: string): string {
  const base = currentSourceMode === "secondary" && API_FALLBACK_URL ? API_FALLBACK_URL : API_BASE_URL;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function fetchJson<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, { cache: "no-store", ...init });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) message = payload.detail;
    } catch {
      // Some proxies return HTML/plain-text errors instead of FastAPI JSON.
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

function isReadRequest(init?: RequestInit): boolean {
  return (init?.method ?? "GET").toUpperCase() === "GET";
}

function canFailOver(error: unknown): boolean {
  // Never mask normal client errors (400/401/403/404/413/415/422). Retry only
  // transient transport failures or server-side 5xx responses.
  return !(error instanceof ApiError) || error.status >= 500;
}

function demoResponse<T>(path: string): T | null {
  const pathname = path.split("?", 1)[0];
  if (pathname === "/api/dashboard/summary") return DEMO_SUMMARY as unknown as T;
  if (pathname === "/api/jobs") return DEMO_JOBS as unknown as T;

  const analyticsMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/analytics$/);
  if (analyticsMatch) return getDemoAnalytics(decodeURIComponent(analyticsMatch[1])) as unknown as T | null;

  const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
  if (jobMatch) return getDemoJob(decodeURIComponent(jobMatch[1])) as unknown as T | null;

  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const readOnly = isReadRequest(init);
  try {
    const data = await fetchJson<T>(API_BASE_URL, path, init);
    setSourceMode("primary", "Connected to the primary API. Live data is being used.");
    return data;
  } catch (primaryError) {
    // A known sample job may still be opened if the live API returns 404 after
    // the dashboard entered demo mode; ordinary 404 responses are not masked.
    const demoJobPath = /^\/api\/jobs\/(demo-[^/?]+)(?:\/analytics)?(?:\?|$)/.test(path);
    if (readOnly && demoJobPath && primaryError instanceof ApiError && primaryError.status === 404) {
      const demo = demoResponse<T>(path);
      if (demo !== null) {
        setSourceMode("demo", "This is a synthetic sample report, not a real analysis.");
        return demo;
      }
    }
    if (!readOnly || !canFailOver(primaryError)) {
      if (!readOnly && !(primaryError instanceof ApiError)) {
        throw new ApiError("The live API is unavailable. Uploads and analysis require a live backend; sample-data fallback is read-only.", 0);
      }
      throw primaryError;
    }

    if (API_FALLBACK_URL && API_FALLBACK_URL !== API_BASE_URL) {
      try {
        const data = await fetchJson<T>(API_FALLBACK_URL, path, init);
        setSourceMode("secondary", "Primary API unavailable. Connected to the configured secondary API.");
        return data;
      } catch (secondaryError) {
        // Only continue to offline fixtures for a transient outage. A genuine
        // client response such as 401/403 must remain visible to the user.
        if (!canFailOver(secondaryError)) {
          if (!(secondaryError instanceof ApiError && secondaryError.status === 404 && demoJobPath)) throw secondaryError;
        }
      }
    }

    const demo = demoResponse<T>(path);
    if (demo !== null) {
      setSourceMode("demo", "Live APIs unavailable. Displaying synthetic sample data only; uploads and analysis require a live API.");
      return demo;
    }
    throw primaryError;
  }
}

export const api = {
  dashboardSummary: () => request<DashboardSummary>("/api/dashboard/summary"),
  jobs: () => request<ProcessingJob[]>("/api/jobs?limit=20"),
  job: (id: string) => request<ProcessingJob>(`/api/jobs/${encodeURIComponent(id)}`),
  analytics: (id: string) => request<AnalyticsResponse>(`/api/jobs/${encodeURIComponent(id)}/analytics`),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    // Do not retry or fake success for POST uploads: if a response is lost after
    // the server accepted the upload, cross-host retry could create duplicate jobs.
    return request<ProcessingJob>("/api/videos", { method: "POST", body: form });
  },
};

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value ?? 0);
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}
