from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.models import ProcessingJob, VideoAsset
from app.db.session import get_db
from app.core.config import settings
from app.main import app
from app.api import routes


@pytest.fixture
def api_context(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db() -> Iterator[Session]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    monkeypatch.setattr(settings, "media_root", tmp_path / "media")
    monkeypatch.setattr(settings, "yolo_config_dir", tmp_path / "ultralytics")
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client, TestingSessionLocal, tmp_path / "media"
    app.dependency_overrides.clear()
    engine.dispose()


def test_upload_queues_video_and_persists_job(api_context, monkeypatch: pytest.MonkeyPatch) -> None:
    client, session_factory, media_root = api_context
    queued_ids: list[str] = []
    monkeypatch.setattr(routes, "enqueue_video_job", lambda job_id: queued_ids.append(job_id))

    response = client.post(
        "/api/videos",
        files={"file": ("store.mp4", b"video-bytes", "video/mp4")},
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["status"] == "queued"
    assert payload["filename"] == "store.mp4"
    assert queued_ids == [payload["id"]]
    assert list((media_root / "uploads").glob("*.mp4"))
    with session_factory() as db:
        assert db.scalar(select(ProcessingJob).where(ProcessingJob.id == payload["id"])) is not None
        assert db.scalar(select(VideoAsset).where(VideoAsset.id == payload["video_id"])) is not None


def test_upload_rejects_unsupported_extension(api_context) -> None:
    client, session_factory, media_root = api_context

    response = client.post(
        "/api/videos",
        files={"file": ("notes.pdf", b"not a video", "application/pdf")},
    )

    assert response.status_code == 415
    with session_factory() as db:
        assert db.scalar(select(ProcessingJob.id)) is None
        assert db.scalar(select(VideoAsset.id)) is None
    assert list((media_root / "uploads").glob("*")) == []


def test_queue_failure_cleans_up_file_and_database_rows(api_context, monkeypatch: pytest.MonkeyPatch) -> None:
    client, session_factory, media_root = api_context

    def fail_enqueue(_job_id: str) -> None:
        raise RuntimeError("redis unavailable")

    monkeypatch.setattr(routes, "enqueue_video_job", fail_enqueue)
    response = client.post(
        "/api/videos",
        files={"file": ("store.mp4", b"video-bytes", "video/mp4")},
    )

    assert response.status_code == 503
    with session_factory() as db:
        assert db.scalar(select(ProcessingJob.id)) is None
        assert db.scalar(select(VideoAsset.id)) is None
    assert list((media_root / "uploads").glob("*.mp4")) == []


def test_empty_video_upload_is_rejected(api_context) -> None:
    client, session_factory, media_root = api_context

    response = client.post(
        "/api/videos",
        files={"file": ("empty.mp4", b"", "video/mp4")},
    )

    assert response.status_code == 400
    with session_factory() as db:
        assert db.scalar(select(ProcessingJob.id)) is None
        assert db.scalar(select(VideoAsset.id)) is None
    assert list((media_root / "uploads").glob("*.mp4")) == []


def test_upload_rejects_oversized_file(api_context, monkeypatch: pytest.MonkeyPatch) -> None:
    client, session_factory, media_root = api_context
    monkeypatch.setattr(settings, "max_upload_mb", 1)

    response = client.post(
        "/api/videos",
        files={"file": ("large.mp4", b"x" * (1024 * 1024 + 1), "video/mp4")},
    )

    assert response.status_code == 413
    with session_factory() as db:
        assert db.scalar(select(ProcessingJob.id)) is None
        assert db.scalar(select(VideoAsset.id)) is None
    assert list((media_root / "uploads").glob("*.mp4")) == []


def test_missing_job_returns_not_found(api_context) -> None:
    client, _session_factory, _media_root = api_context

    response = client.get("/api/jobs/not-a-real-job")

    assert response.status_code == 404
    assert response.json()["detail"] == "Analysis job not found."


def test_analytics_exposes_estimated_people_field(api_context) -> None:
    from app.db.models import MetricPoint

    client, session_factory, _media_root = api_context
    with session_factory() as db:
        asset = VideoAsset(
            original_filename="sample.mp4",
            stored_path="/not-used/sample.mp4",
            mime_type="video/mp4",
            size_bytes=10,
        )
        job = ProcessingJob(video=asset, status="completed", source_fps=25.0)
        db.add(job)
        db.commit()
        db.refresh(job)
        job_id = job.id
        db.add(
            MetricPoint(
                job_id=job_id,
                frame_index=0,
                timestamp_seconds=0.0,
                people_count=3,
                detection_count=8,
            )
        )
        db.commit()

    response = client.get(f"/api/jobs/{job_id}/analytics")

    assert response.status_code == 200
    payload = response.json()
    assert payload["timeline"] == [
        {"time_seconds": 0.0, "estimated_people_count": 3, "detection_count": 8}
    ]


def test_dashboard_summary_is_zeroed_for_empty_database(api_context) -> None:
    client, _session_factory, _media_root = api_context

    response = client.get("/api/dashboard/summary")

    assert response.status_code == 200
    payload = response.json()
    assert payload["jobs_total"] == 0
    assert payload["jobs_completed"] == 0
    assert payload["jobs_processing"] == 0
    assert payload["detections_total"] == 0
    assert payload["tracks_total"] == 0
    assert payload["people_tracks_total"] == 0
