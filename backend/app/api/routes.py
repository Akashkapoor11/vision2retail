import logging
import mimetypes
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, joinedload

from app.api.schemas import (
    AnalyticsResponse,
    DashboardSummaryResponse,
    HealthResponse,
    JobResponse,
    ObservationsResponse,
)
from app.core.config import settings
from app.db.models import MetricPoint, ProcessingJob, TrackObservation, TrackSummary, VideoAsset
from app.db.session import get_db
from app.services.jobs import enqueue_video_job
from app.services.video_files import allowed_video_extension, make_upload_path

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


def job_payload(job: ProcessingJob) -> dict:
    video = job.video
    return {
        "id": job.id,
        "video_id": job.video_id,
        "filename": video.original_filename if video else "Unknown video",
        "status": job.status,
        "stage": job.stage,
        "progress_percent": job.progress_percent,
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "duration_seconds": job.duration_seconds,
        "width": job.width,
        "height": job.height,
        "source_fps": job.source_fps,
        "total_frames": job.total_frames,
        "processed_frames": job.processed_frames,
        "detections_count": job.detections_count,
        "unique_tracks_count": job.unique_tracks_count,
        "person_tracks_count": job.person_tracks_count,
        "processing_fps": job.processing_fps,
        "summary": job.summary_json,
        "has_annotated_video": bool(job.output_video_path and Path(job.output_video_path).exists()),
        "has_heatmap": bool(job.heatmap_path and Path(job.heatmap_path).exists()),
    }


@router.get("/health", response_model=HealthResponse, tags=["operations"])
def health(db: Session = Depends(get_db)) -> JSONResponse:
    """Report dependency health without hiding database failures behind a generic 500."""
    from redis import Redis
    from sqlalchemy import text

    database_status = "ok"
    redis_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db.rollback()
        database_status = "unavailable"
        logger.exception("Database health check failed")

    client = None
    try:
        client = Redis.from_url(settings.redis_url, socket_connect_timeout=2)
        client.ping()
    except Exception:
        redis_status = "unavailable"
        logger.exception("Redis health check failed")
    finally:
        if client is not None:
            client.close()

    healthy = database_status == "ok" and redis_status == "ok"
    return JSONResponse(
        status_code=200 if healthy else 503,
        content={
            "status": "ok" if healthy else "degraded",
            "database": database_status,
            "redis": redis_status,
        },
    )


@router.post("/videos", status_code=status.HTTP_202_ACCEPTED, response_model=JobResponse, tags=["videos"])
def upload_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    """Upload and enqueue a video for analysis.

    Accepts MP4, MOV, AVI, MKV and WEBM. Returns HTTP 202 with the new job payload
    immediately; processing continues asynchronously in the Celery worker.

    - **413** – File exceeds the configured upload limit.
    - **415** – Unsupported file extension.
    - **400** – Empty file.
    - **503** – Processing queue unavailable.
    """
    # Normalize Windows-style separators too; stored paths are always generated independently.
    supplied_name = (file.filename or "upload.mp4").replace("\\", "/")
    original_name = Path(supplied_name).name[:255] or "upload.mp4"
    if not allowed_video_extension(original_name):
        raise HTTPException(status_code=415, detail="Unsupported format. Upload MP4, MOV, AVI, MKV, or WEBM.")

    destination = make_upload_path(settings.media_root, original_name)
    max_bytes = settings.max_upload_mb * 1024 * 1024
    size = 0
    try:
        with destination.open("wb") as output:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(status_code=413, detail=f"Video exceeds the {settings.max_upload_mb} MB upload limit.")
                output.write(chunk)
        if size == 0:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")

        asset = VideoAsset(
            original_filename=original_name,
            stored_path=str(destination),
            mime_type=(file.content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream")[:120],
            size_bytes=size,
        )
        db.add(asset)
        db.flush()
        job = ProcessingJob(video_id=asset.id, status="queued", stage="Queued for processing", progress_percent=0)
        db.add(job)
        db.commit()
        db.refresh(job)
        try:
            enqueue_video_job(job.id)
        except Exception as exc:
            logger.exception("Could not queue processing job %s", job.id)
            # The job was already committed. Remove its records as well as the saved upload so
            # a queue outage does not leave a failed job pointing at a missing file.
            db.rollback()
            try:
                persisted_job = db.get(ProcessingJob, job.id)
                persisted_asset = db.get(VideoAsset, asset.id)
                if persisted_job is not None:
                    db.delete(persisted_job)
                if persisted_asset is not None:
                    db.delete(persisted_asset)
                db.commit()
            except Exception:
                db.rollback()
                logger.exception("Could not clean up job %s after queue failure", job.id)
            destination.unlink(missing_ok=True)
            raise HTTPException(status_code=503, detail="Processing queue unavailable. Please retry shortly.") from exc
        return job_payload(job)
    except HTTPException:
        destination.unlink(missing_ok=True)
        raise
    except Exception as exc:
        destination.unlink(missing_ok=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="The video could not be saved.") from exc
    finally:
        file.file.close()


@router.get("/jobs", response_model=list[JobResponse], tags=["jobs"])
def list_jobs(
    limit: int = Query(default=12, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return the most recent processing jobs ordered by creation time (newest first)."""
    jobs = db.scalars(
        select(ProcessingJob).options(joinedload(ProcessingJob.video)).order_by(desc(ProcessingJob.created_at)).limit(limit)
    ).all()
    return [job_payload(job) for job in jobs]


@router.get("/jobs/{job_id}", response_model=JobResponse, tags=["jobs"])
def get_job(job_id: str, db: Session = Depends(get_db)) -> dict:
    """Return status, progress and result summary for a single job."""
    job = db.scalar(select(ProcessingJob).options(joinedload(ProcessingJob.video)).where(ProcessingJob.id == job_id))
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found.")
    return job_payload(job)


@router.get("/jobs/{job_id}/analytics", response_model=AnalyticsResponse, tags=["analytics"])
def get_analytics(job_id: str, db: Session = Depends(get_db)) -> dict:
    """Return the sampled activity timeline and top per-track summaries for a completed job."""
    job = db.get(ProcessingJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found.")
    metrics = db.scalars(
        select(MetricPoint).where(MetricPoint.job_id == job_id).order_by(MetricPoint.frame_index)
    ).all()
    tracks = db.scalars(
        select(TrackSummary).where(TrackSummary.job_id == job_id).order_by(desc(TrackSummary.frames_seen)).limit(100)
    ).all()
    return {
        "job_id": job_id,
        "summary": job.summary_json or {},
        "timeline": [
            {
                "time_seconds": round(point.timestamp_seconds, 2),
                "estimated_people_count": point.people_count,
                "detection_count": point.detection_count,
            }
            for point in metrics
        ],
        "tracks": [
            {
                "track_id": track.track_id,
                "class_name": track.class_name,
                "first_seen_seconds": round(track.first_seen_frame / (job.source_fps or 1), 2),
                "duration_seconds": round(track.duration_seconds, 2),
                "frames_seen": track.frames_seen,
                "average_confidence": round(track.average_confidence, 3),
            }
            for track in tracks
        ],
    }


@router.get("/jobs/{job_id}/observations", response_model=ObservationsResponse, tags=["analytics"])
def get_observations(
    job_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> dict:
    """Return paginated bounding-box observations for a job. Use limit/offset for paging."""
    if not db.get(ProcessingJob, job_id):
        raise HTTPException(status_code=404, detail="Analysis job not found.")
    total = db.scalar(select(func.count()).select_from(TrackObservation).where(TrackObservation.job_id == job_id)) or 0
    rows = db.scalars(
        select(TrackObservation).where(TrackObservation.job_id == job_id)
        .order_by(TrackObservation.frame_index, TrackObservation.id).offset(offset).limit(limit)
    ).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [
            {
                "frame_index": item.frame_index,
                "time_seconds": round(item.timestamp_seconds, 2),
                "track_id": item.track_id,
                "class_name": item.class_name,
                "confidence": round(item.confidence, 3),
                "bbox": [round(item.x1, 1), round(item.y1, 1), round(item.x2, 1), round(item.y2, 1)],
            }
            for item in rows
        ],
    }


@router.get("/jobs/{job_id}/annotated-video", tags=["reports"])
def annotated_video(job_id: str, db: Session = Depends(get_db)) -> FileResponse:
    job = db.get(ProcessingJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found.")
    path = Path(job.output_video_path or "")
    if job.status != "completed" or not path.is_file():
        raise HTTPException(status_code=404, detail="Annotated video is not available yet.")
    return FileResponse(path, media_type="video/mp4", filename=f"vision2retail-{job_id[:8]}.mp4")


@router.get("/jobs/{job_id}/heatmap", tags=["reports"])
def heatmap(job_id: str, db: Session = Depends(get_db)) -> FileResponse:
    job = db.get(ProcessingJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found.")
    path = Path(job.heatmap_path or "")
    if job.status != "completed" or not path.is_file():
        raise HTTPException(status_code=404, detail="Heatmap is not available yet.")
    return FileResponse(path, media_type="image/png", filename=f"vision2retail-heatmap-{job_id[:8]}.png")


@router.get("/dashboard/summary", response_model=DashboardSummaryResponse, tags=["dashboard"])
def dashboard_summary(db: Session = Depends(get_db)) -> dict:
    """Return aggregated totals across all completed jobs for the dashboard overview."""
    completed_filter = ProcessingJob.status == "completed"
    jobs_total = db.scalar(select(func.count()).select_from(ProcessingJob)) or 0
    jobs_completed = db.scalar(
        select(func.count()).select_from(ProcessingJob).where(completed_filter)
    ) or 0
    jobs_processing = db.scalar(
        select(func.count()).select_from(ProcessingJob).where(ProcessingJob.status.in_(["queued", "processing"]))
    ) or 0
    detections_total = db.scalar(
        select(func.coalesce(func.sum(ProcessingJob.detections_count), 0)).where(completed_filter)
    ) or 0
    tracks_total = db.scalar(
        select(func.coalesce(func.sum(ProcessingJob.unique_tracks_count), 0)).where(completed_filter)
    ) or 0
    people_tracks_total = db.scalar(
        select(func.coalesce(func.sum(ProcessingJob.person_tracks_count), 0)).where(completed_filter)
    ) or 0
    return {
        "jobs_total": jobs_total,
        "jobs_completed": jobs_completed,
        "jobs_processing": jobs_processing,
        "detections_total": detections_total,
        "tracks_total": tracks_total,
        "people_tracks_total": people_tracks_total,
        "last_updated_at": datetime.now(timezone.utc).isoformat(),
    }
