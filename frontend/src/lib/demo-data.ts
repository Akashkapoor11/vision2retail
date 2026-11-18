import type { AnalyticsResponse, DashboardSummary, ProcessingJob } from "@/types";

/**
 * Explicitly synthetic, read-only fallback fixtures. Never use these values for
 * uploads, database writes, AI inference, or claims about a real store.
 */
const now = Date.now();
const stamp = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

export const DEMO_JOBS: ProcessingJob[] = [
  {
    id: "demo-retail-completed-01",
    video_id: "demo-video-01",
    filename: "sample-retail-aisle.mp4",
    status: "completed",
    stage: "Demo fixture — no video processed",
    progress_percent: 100,
    error_message: null,
    created_at: stamp(42),
    started_at: stamp(41),
    completed_at: stamp(39),
    duration_seconds: 36,
    width: 1280,
    height: 720,
    source_fps: 25,
    total_frames: 900,
    processed_frames: 180,
    detections_count: 428,
    unique_tracks_count: 31,
    person_tracks_count: 18,
    processing_fps: 72.4,
    summary: {
      model: "DEMO ONLY — YOLOv8 not executed",
      tracker: "DEMO ONLY — ByteTrack not executed",
      confidence_threshold: 0.25,
      analysis_stride_frames: 5,
      sampled_detections_by_class: { person: 286, backpack: 36, bottle: 22, handbag: 84 },
      unique_tracks_by_class: { person: 18, backpack: 3, bottle: 4, handbag: 6 },
      peak_estimated_people_in_frame: 5,
      analyzed_first_seconds_only: 36,
      scope_note: "Synthetic demonstration data only. No real video has been processed.",
      metrics_note: "Illustrative values; not model measurements.",
    },
    has_annotated_video: false,
    has_heatmap: false,
  },
  {
    id: "demo-retail-completed-02",
    video_id: "demo-video-02",
    filename: "sample-checkout-area.mp4",
    status: "completed",
    stage: "Demo fixture — no video processed",
    progress_percent: 100,
    error_message: null,
    created_at: stamp(160),
    started_at: stamp(159),
    completed_at: stamp(157),
    duration_seconds: 24,
    width: 1280,
    height: 720,
    source_fps: 25,
    total_frames: 600,
    processed_frames: 120,
    detections_count: 312,
    unique_tracks_count: 24,
    person_tracks_count: 15,
    processing_fps: 68.1,
    summary: {
      model: "DEMO ONLY — YOLOv8 not executed",
      tracker: "DEMO ONLY — ByteTrack not executed",
      confidence_threshold: 0.25,
      analysis_stride_frames: 5,
      sampled_detections_by_class: { person: 214, handbag: 51, bottle: 17, backpack: 30 },
      unique_tracks_by_class: { person: 15, handbag: 4, bottle: 2, backpack: 3 },
      peak_estimated_people_in_frame: 4,
      analyzed_first_seconds_only: 24,
      scope_note: "Synthetic demonstration data only. No real video has been processed.",
      metrics_note: "Illustrative values; not model measurements.",
    },
    has_annotated_video: false,
    has_heatmap: false,
  },

];

export const DEMO_SUMMARY: DashboardSummary = {
  jobs_total: 2,
  jobs_completed: 2,
  jobs_processing: 0,
  detections_total: 740,
  tracks_total: 55,
  people_tracks_total: 33,
  last_updated_at: stamp(0),
};

export function getDemoJob(id: string): ProcessingJob | null {
  return DEMO_JOBS.find((job) => job.id === id) ?? null;
}

export function getDemoAnalytics(id: string): AnalyticsResponse | null {
  const job = getDemoJob(id);
  if (!job) return null;
  if (job.status !== "completed") {
    return {
      job_id: id,
      summary: job.summary ?? {},
      timeline: [],
      tracks: [],
    };
  }
  const counts = [2, 3, 4, 5, 4, 3, 2, 4, 5, 3, 2, 3];
  return {
    job_id: id,
    summary: job.summary ?? {},
    timeline: counts.map((people, index) => ({
      time_seconds: index * 3,
      estimated_people_count: people,
      detection_count: people * 7 + (index % 3) * 2,
    })),
    tracks: [],
  };
}
