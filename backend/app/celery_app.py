from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "vision2retail",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.video_tasks"],
)
celery_app.conf.update(
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,
    result_expires=3600,
    broker_connection_retry_on_startup=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)
