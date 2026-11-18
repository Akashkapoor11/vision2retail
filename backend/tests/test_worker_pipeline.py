"""Exercise the worker pipeline with deterministic fake model outputs and real OpenCV video I/O."""
from __future__ import annotations

import importlib
import sys
import types
from pathlib import Path

import numpy as np
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
from app.db.models import MetricPoint, ProcessingJob, TrackSummary, VideoAsset


class FakeTensor:
    def __init__(self, value):
        self.value = np.asarray(value)

    def cpu(self):
        return self

    def numpy(self):
        return self.value

    def int(self):
        return self

    def tolist(self):
        return self.value.tolist()


class FakeBoxes:
    def __init__(self, coordinates, classes, confidence, track_ids):
        self.xyxy = FakeTensor(coordinates)
        self.cls = FakeTensor(classes)
        self.conf = FakeTensor(confidence)
        self.id = None if track_ids is None else FakeTensor(track_ids)

    def __len__(self):
        return len(self.xyxy.value)


class FakeResult:
    names = {0: "person"}

    def __init__(self, frame, boxes):
        self.frame = frame
        self.boxes = boxes

    def plot(self):
        return self.frame


class FakeYOLO:
    def __init__(self, _model_name):
        self.frame_index = 0

    def track(self, frame, **_kwargs):
        if self.frame_index == 0:
            boxes = FakeBoxes(
                [[5, 5, 20, 30], [25, 5, 40, 30]], [0, 0], [0.9, 0.8], [101, 102]
            )
        else:
            # Simulate an inference frame where the tracker provides no IDs.
            boxes = FakeBoxes(
                [[5, 5, 20, 30], [22, 5, 37, 30], [40, 5, 55, 30]],
                [0, 0, 0], [0.9, 0.85, 0.75], None,
            )
        self.frame_index += 1
        return [FakeResult(frame, boxes)]


def _load_worker_with_stubs(monkeypatch: pytest.MonkeyPatch):
    fake_celery_module = types.ModuleType("celery")

    class FakeCelery:
        def __init__(self, *_args, **_kwargs):
            self.conf = types.SimpleNamespace(update=lambda **_settings: None)

        def task(self, **_kwargs):
            return lambda function: function

    fake_celery_module.Celery = FakeCelery
    fake_ultralytics_module = types.ModuleType("ultralytics")
    fake_ultralytics_module.YOLO = FakeYOLO
    monkeypatch.setitem(sys.modules, "celery", fake_celery_module)
    monkeypatch.setitem(sys.modules, "ultralytics", fake_ultralytics_module)
    sys.modules.pop("app.celery_app", None)
    sys.modules.pop("app.workers.video_tasks", None)
    return importlib.import_module("app.workers.video_tasks")


def _make_video(path: Path) -> None:
    import cv2

    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 10.0, (64, 48))
    if not writer.isOpened():
        pytest.skip("This environment lacks an OpenCV video writer codec needed for the worker test.")
    try:
        writer.write(np.zeros((48, 64, 3), dtype=np.uint8))
        writer.write(np.full((48, 64, 3), 80, dtype=np.uint8))
    finally:
        writer.release()


def test_worker_completes_pipeline_and_counts_mixed_tracking_situations(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, request: pytest.FixtureRequest
) -> None:
    import cv2

    source = tmp_path / "input.avi"
    _make_video(source)
    capture = cv2.VideoCapture(str(source))
    assert capture.isOpened()
    capture.release()

    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    media_root = tmp_path / "media"
    monkeypatch.setattr(settings, "media_root", media_root)
    monkeypatch.setattr(settings, "max_video_seconds", 5)
    monkeypatch.setattr(settings, "analytics_sample_every_n_frames", 1)
    monkeypatch.setattr(settings, "image_size", 320)
    monkeypatch.setattr(settings, "yolo_device", "auto")
    worker = _load_worker_with_stubs(monkeypatch)
    monkeypatch.setattr(worker, "SessionLocal", TestSessionLocal)

    def cleanup() -> None:
        sys.modules.pop("app.workers.video_tasks", None)
        sys.modules.pop("app.celery_app", None)
        engine.dispose()

    request.addfinalizer(cleanup)

    with TestSessionLocal() as db:
        asset = VideoAsset(
            original_filename="input.avi",
            stored_path=str(source),
            mime_type="video/x-msvideo",
            size_bytes=source.stat().st_size,
        )
        job = ProcessingJob(video=asset, status="queued", stage="Queued for processing")
        db.add(job)
        db.commit()
        db.refresh(job)
        job_id = job.id

    result = worker.process_video_job(None, job_id)
    assert result["status"] == "completed"

    with TestSessionLocal() as db:
        job = db.get(ProcessingJob, job_id)
        assert job is not None
        assert job.status == "completed"
        assert job.progress_percent == 100
        assert job.processed_frames == 2
        assert job.total_frames == 2
        assert job.detections_count == 5
        assert job.unique_tracks_count == 2
        assert job.person_tracks_count == 2
        assert job.summary_json["peak_estimated_people_in_frame"] == 3
        timeline = db.scalars(select(MetricPoint).where(MetricPoint.job_id == job_id).order_by(MetricPoint.frame_index)).all()
        assert [point.people_count for point in timeline] == [2, 3]
        tracks = db.scalars(select(TrackSummary).where(TrackSummary.job_id == job_id)).all()
        assert len(tracks) == 2
        assert job.output_video_path and Path(job.output_video_path).is_file()
        assert job.heatmap_path and Path(job.heatmap_path).is_file()
        output_capture = cv2.VideoCapture(job.output_video_path)
        try:
            ok, frame = output_capture.read()
            assert ok and frame is not None
        finally:
            output_capture.release()

