"""Queue orchestration kept separate from HTTP route definitions."""


def enqueue_video_job(job_id: str) -> None:
    """Send a processing task to Celery without importing the inference worker in the API."""
    from app.celery_app import celery_app

    celery_app.send_task("vision2retail.process_video", args=[job_id])
