"""Pydantic response schemas for Vision2Retail API.

These are separate from the SQLAlchemy ORM models to keep the API contract
explicit and independent of the database layer.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    video_id: str
    filename: str
    status: str
    stage: str
    progress_percent: int
    error_message: str | None
    created_at: str | None
    started_at: str | None
    completed_at: str | None
    duration_seconds: float | None
    width: int | None
    height: int | None
    source_fps: float | None
    total_frames: int
    processed_frames: int
    detections_count: int
    unique_tracks_count: int
    person_tracks_count: int
    processing_fps: float | None
    summary: dict[str, Any] | None
    has_annotated_video: bool
    has_heatmap: bool


class TimelinePoint(BaseModel):
    time_seconds: float
    estimated_people_count: int
    detection_count: int


class TrackEntry(BaseModel):
    track_id: int
    class_name: str
    first_seen_seconds: float
    duration_seconds: float
    frames_seen: int
    average_confidence: float


class AnalyticsResponse(BaseModel):
    job_id: str
    summary: dict[str, Any]
    timeline: list[TimelinePoint]
    tracks: list[TrackEntry]


class ObservationItem(BaseModel):
    frame_index: int
    time_seconds: float
    track_id: int | None
    class_name: str
    confidence: float
    bbox: list[float]


class ObservationsResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[ObservationItem]


class DashboardSummaryResponse(BaseModel):
    jobs_total: int
    jobs_completed: int
    jobs_processing: int
    detections_total: int
    tracks_total: int
    people_tracks_total: int
    last_updated_at: str


class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str