import logging
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

from app.celery_app import celery_app
from app.core.config import settings
from app.db.models import MetricPoint, ProcessingJob, TrackObservation, TrackSummary, VideoAsset
from app.db.session import SessionLocal
from app.services.analytics import estimate_people_in_frame

logger = logging.getLogger(__name__)


def _safe_release(resource, resource_name: str) -> None:
    if resource is None:
        return
    try:
        resource.release()
    except Exception:
        logger.warning("Failed to release %s cleanly", resource_name, exc_info=True)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@celery_app.task(bind=True, name="vision2retail.process_video", acks_late=True)
def process_video_job(self, job_id: str) -> dict:
    """Detect and track objects in a video, storing sampled observations and metrics."""
    db = SessionLocal()
    capture = None
    writer = None
    output_path: Path | None = None
    heatmap_path: Path | None = None
    try:
        import cv2
        import numpy as np
        settings.yolo_config_dir.mkdir(parents=True, exist_ok=True)
        # Ultralytics reads this environment variable during import; settings loaded from
        # a .env file alone do not automatically populate os.environ.
        os.environ.setdefault("YOLO_CONFIG_DIR", str(settings.yolo_config_dir))
        from ultralytics import YOLO

        job = db.get(ProcessingJob, job_id)
        if job is None:
            return {"job_id": job_id, "status": "not_found"}
        asset = db.get(VideoAsset, job.video_id)
        if asset is None or not Path(asset.stored_path).is_file():
            raise FileNotFoundError("The uploaded video is no longer available.")

        # Clear stale partial results if Celery redelivers a task after a worker interruption.
        db.query(TrackSummary).filter(TrackSummary.job_id == job_id).delete(synchronize_session=False)
        db.query(MetricPoint).filter(MetricPoint.job_id == job_id).delete(synchronize_session=False)
        db.query(TrackObservation).filter(TrackObservation.job_id == job_id).delete(synchronize_session=False)
        db.commit()

        media_root = settings.media_root
        processed_dir = media_root / "processed"
        processed_dir.mkdir(parents=True, exist_ok=True)
        output_path = processed_dir / f"{job_id}_annotated.mp4"
        heatmap_path = processed_dir / f"{job_id}_heatmap.png"
        output_path.unlink(missing_ok=True)
        heatmap_path.unlink(missing_ok=True)

        job.status = "processing"
        job.stage = "Loading computer-vision model"
        job.started_at = utcnow()
        job.completed_at = None
        job.error_message = None
        job.progress_percent = 1
        job.duration_seconds = None
        job.width = None
        job.height = None
        job.source_fps = None
        job.total_frames = 0
        job.processed_frames = 0
        job.detections_count = 0
        job.unique_tracks_count = 0
        job.person_tracks_count = 0
        job.processing_fps = None
        job.output_video_path = None
        job.heatmap_path = None
        job.summary_json = None
        db.commit()

        model = YOLO(settings.yolo_model)
        capture = cv2.VideoCapture(asset.stored_path)
        if not capture.isOpened():
            raise ValueError("The uploaded file could not be opened as a video.")

        original_fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
        fps = original_fps if 1.0 <= original_fps <= 240.0 else 25.0
        original_total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        if width < 1 or height < 1:
            raise ValueError("Video metadata is invalid; the frame dimensions could not be read.")
        if width * height > 12_000_000:
            raise ValueError("Video resolution exceeds the 12-megapixel per-frame safety limit.")

        frame_cap = int(settings.max_video_seconds * fps)
        total_frames = min(original_total_frames, frame_cap) if original_total_frames > 0 else frame_cap
        total_frames = max(total_frames, 1)
        writer = cv2.VideoWriter(
            str(output_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height)
        )
        if not writer.isOpened():
            raise RuntimeError("Could not initialize the annotated-video writer.")

        job.width = width
        job.height = height
        job.source_fps = fps
        job.total_frames = total_frames
        job.duration_seconds = round(total_frames / fps, 2)
        job.stage = "Detecting and tracking objects"
        db.commit()

        stride = settings.analytics_sample_every_n_frames
        class_detection_counts: Counter[str] = Counter()
        track_stats: dict[tuple[int, int], dict] = {}
        unique_tracks: set[tuple[int, int]] = set()
        unique_people: set[tuple[int, int]] = set()
        person_centroid_count = 0
        peak_people = 0
        detection_count = 0
        processed_frames = 0
        pending_observations: list[TrackObservation] = []
        run_started = perf_counter()
        heat_accumulator = np.zeros((height, width), dtype=np.float32)

        frame_index = 0
        while frame_index < total_frames:
            ok, frame = capture.read()
            if not ok:
                break

            results = model.track(
                frame,
                persist=True,
                tracker=settings.tracker_config,
                conf=settings.confidence_threshold,
                imgsz=settings.image_size,
                device=None if settings.yolo_device.lower() == "auto" else settings.yolo_device,
                verbose=False,
            )
            result = results[0]
            writer.write(result.plot())
            boxes = result.boxes
            frame_detections = 0
            untracked_person_detections = 0
            active_people: set[int] = set()

            if boxes is not None and len(boxes) > 0:
                xyxy = boxes.xyxy.cpu().numpy()
                confs = boxes.conf.cpu().numpy()
                class_ids = boxes.cls.int().cpu().tolist()
                raw_ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(class_ids)
                names = result.names
                for coords, confidence, class_id, track_id in zip(
                    xyxy, confs, class_ids, raw_ids, strict=False
                ):
                    class_name = str(names.get(int(class_id), class_id) if isinstance(names, dict) else names[int(class_id)])
                    x1, y1, x2, y2 = [float(value) for value in coords]
                    frame_detections += 1
                    detection_count += 1
                    is_person = class_name.lower() == "person"
                    if is_person and track_id is None:
                        untracked_person_detections += 1
                    if track_id is not None:
                        key = (int(class_id), int(track_id))
                        unique_tracks.add(key)
                        if is_person:
                            unique_people.add(key)
                            active_people.add(int(track_id))
                        if key not in track_stats:
                            track_stats[key] = {
                                "track_id": int(track_id), "class_id": int(class_id),
                                "class_name": class_name, "first": frame_index, "last": frame_index,
                                "frames": 0, "confidence_sum": 0.0,
                            }
                        stats = track_stats[key]
                        stats["last"] = frame_index
                        stats["frames"] += 1
                        stats["confidence_sum"] += float(confidence)

                    if frame_index % stride == 0:
                        class_detection_counts[class_name] += 1
                        pending_observations.append(
                            TrackObservation(
                                job_id=job_id,
                                frame_index=frame_index,
                                timestamp_seconds=round(frame_index / fps, 3),
                                track_id=int(track_id) if track_id is not None else None,
                                class_id=int(class_id),
                                class_name=class_name,
                                confidence=float(confidence),
                                x1=x1, y1=y1, x2=x2, y2=y2,
                            )
                        )
                        if class_name.lower() == "person":
                            cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
                            if 0 <= cx < width and 0 <= cy < height:
                                heat_accumulator[cy, cx] += 1.0
                                person_centroid_count += 1

            frame_people_count = estimate_people_in_frame(active_people, untracked_person_detections)
            peak_people = max(peak_people, frame_people_count)
            if frame_index % stride == 0:
                db.add(
                    MetricPoint(
                        job_id=job_id,
                        frame_index=frame_index,
                        timestamp_seconds=round(frame_index / fps, 3),
                        people_count=frame_people_count,
                        detection_count=frame_detections,
                    )
                )

            processed_frames += 1
            frame_index += 1
            if len(pending_observations) >= 1000:
                db.add_all(pending_observations)
                pending_observations.clear()

            if frame_index % 25 == 0 or frame_index >= total_frames:
                job.processed_frames = processed_frames
                job.detections_count = detection_count
                job.unique_tracks_count = len(unique_tracks)
                job.person_tracks_count = len(unique_people)
                job.progress_percent = min(95, int(processed_frames * 95 / total_frames))
                job.stage = f"Processed {processed_frames:,} of {total_frames:,} frames"
                if pending_observations:
                    db.add_all(pending_observations)
                    pending_observations.clear()
                db.commit()

        # Finalize the encoded artifact before the job can be observed as completed. In
        # particular, a browser must not download the MP4 while OpenCV still has it open.
        _safe_release(capture, "video capture")
        capture = None
        _safe_release(writer, "video writer")
        writer = None
        if output_path is None or not output_path.is_file() or output_path.stat().st_size == 0:
            raise RuntimeError("The annotated video output is empty or was not created.")
        verification_capture = cv2.VideoCapture(str(output_path))
        try:
            output_ok, _ = verification_capture.read()
        finally:
            verification_capture.release()
        if not output_ok:
            raise RuntimeError("The annotated video output could not be reopened for verification.")

        if pending_observations:
            db.add_all(pending_observations)
        if processed_frames == 0:
            raise ValueError("No readable video frames were found.")

        db.add_all(
            [
                TrackSummary(
                    job_id=job_id,
                    track_id=stats["track_id"],
                    class_id=stats["class_id"],
                    class_name=stats["class_name"],
                    first_seen_frame=stats["first"],
                    last_seen_frame=stats["last"],
                    frames_seen=stats["frames"],
                    average_confidence=stats["confidence_sum"] / max(stats["frames"], 1),
                    duration_seconds=max(0.0, (stats["last"] - stats["first"] + 1) / fps),
                )
                for stats in track_stats.values()
            ]
        )

        blurred = cv2.GaussianBlur(heat_accumulator, (0, 0), sigmaX=max(width, height) / 100)
        normalized = cv2.normalize(blurred, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        colored = cv2.applyColorMap(normalized, cv2.COLORMAP_TURBO)
        if person_centroid_count == 0:
            cv2.putText(
                colored, "No person detections in analyzed frames", (20, max(40, height // 2)),
                cv2.FONT_HERSHEY_SIMPLEX, max(0.5, width / 1400), (255, 255, 255), 2,
            )
        if not cv2.imwrite(str(heatmap_path), colored):
            heatmap_path = None

        elapsed = max(perf_counter() - run_started, 0.001)
        processing_fps = processed_frames / elapsed
        total_unique = len(unique_tracks)
        was_capped = processed_frames >= frame_cap and (original_total_frames <= 0 or original_total_frames > frame_cap)
        job.status = "completed"
        job.stage = "Analysis completed"
        job.progress_percent = 100
        job.processed_frames = processed_frames
        job.total_frames = processed_frames
        job.detections_count = detection_count
        job.unique_tracks_count = total_unique
        job.person_tracks_count = len(unique_people)
        job.duration_seconds = round(processed_frames / fps, 2)
        job.processing_fps = round(processing_fps, 2)
        job.output_video_path = str(output_path) if output_path and output_path.exists() else None
        job.heatmap_path = str(heatmap_path) if heatmap_path and heatmap_path.exists() else None
        job.completed_at = utcnow()
        job.summary_json = {
            "model": settings.yolo_model,
            "tracker": settings.tracker_config,
            "confidence_threshold": settings.confidence_threshold,
            "analysis_stride_frames": stride,
            "sampled_detections_by_class": dict(class_detection_counts),
            "unique_tracks_by_class": {
                name: len({track_id for class_id, track_id in unique_tracks
                           if track_stats[(class_id, track_id)]["class_name"] == name})
                for name in sorted({stats["class_name"] for stats in track_stats.values()})
            },
            "peak_estimated_people_in_frame": peak_people,
            "analyzed_first_seconds_only": settings.max_video_seconds if was_capped else None,
            "scope_note": "Track IDs are within this video only. Detection and track counts are not verified unique customer counts. Heatmap shows sampled person-detection centroids.",
            "metrics_note": "Detection totals count model detections across processed frames; class breakdown uses sampled frames only. People per sampled frame combine distinct tracked person IDs with person detections that have no track ID. This estimate is not a unique-customer count.",
        }
        db.commit()
        return {"job_id": job_id, "status": "completed", "processed_frames": processed_frames}
    except Exception:
        logger.exception("Video analysis failed for job %s", job_id)
        _safe_release(capture, "video capture")
        capture = None
        _safe_release(writer, "video writer")
        writer = None
        db.rollback()
        # Checkpoint commits make progress observable during processing. If the task fails,
        # remove those partial rows so a failed job cannot masquerade as a complete result.
        db.query(TrackSummary).filter(TrackSummary.job_id == job_id).delete(synchronize_session=False)
        db.query(MetricPoint).filter(MetricPoint.job_id == job_id).delete(synchronize_session=False)
        db.query(TrackObservation).filter(TrackObservation.job_id == job_id).delete(synchronize_session=False)
        failed = db.get(ProcessingJob, job_id)
        if failed is not None:
            failed.status = "failed"
            failed.stage = "Analysis failed"
            failed.error_message = (
                "Video analysis failed. Check the worker logs and verify the video and model configuration."
            )
            failed.completed_at = utcnow()
            failed.progress_percent = 0
            failed.processed_frames = 0
            failed.detections_count = 0
            failed.unique_tracks_count = 0
            failed.person_tracks_count = 0
            failed.processing_fps = None
            failed.output_video_path = None
            failed.heatmap_path = None
            failed.summary_json = None
            db.commit()
        if output_path:
            output_path.unlink(missing_ok=True)
        if heatmap_path:
            heatmap_path.unlink(missing_ok=True)
        raise
    finally:
        _safe_release(capture, "video capture")
        _safe_release(writer, "video writer")
        db.close()
