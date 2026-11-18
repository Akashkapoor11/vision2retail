export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface ProcessingJob {
  id: string;
  video_id: string;
  filename: string;
  status: JobStatus;
  stage: string;
  progress_percent: number;
  error_message: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  source_fps: number | null;
  total_frames: number;
  processed_frames: number;
  detections_count: number;
  unique_tracks_count: number;
  person_tracks_count: number;
  processing_fps: number | null;
  summary: JobSummary | null;
  has_annotated_video: boolean;
  has_heatmap: boolean;
}

export interface JobSummary {
  model?: string;
  tracker?: string;
  confidence_threshold?: number;
  analysis_stride_frames?: number;
  sampled_detections_by_class?: Record<string, number>;
  unique_tracks_by_class?: Record<string, number>;
  peak_estimated_people_in_frame?: number;
  analyzed_first_seconds_only?: number | null;
  scope_note?: string;
  metrics_note?: string;
}

export interface DashboardSummary {
  jobs_total: number;
  jobs_completed: number;
  jobs_processing: number;
  detections_total: number;
  tracks_total: number;
  people_tracks_total: number;
  last_updated_at: string;
}

export interface AnalyticsResponse {
  job_id: string;
  summary: JobSummary;
  timeline: { time_seconds: number; estimated_people_count: number; detection_count: number }[];
  tracks: {
    track_id: number;
    class_name: string;
    first_seen_seconds: number;
    duration_seconds: number;
    frames_seen: number;
    average_confidence: number;
  }[];
}
