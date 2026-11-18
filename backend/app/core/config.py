from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Vision2Retail API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://vision2retail:change-me-local-only@localhost:5432/vision2retail"
    redis_url: str = "redis://localhost:6379/0"
    media_root: Path = Path("./.data/media")
    yolo_config_dir: Path = Path("./.data/ultralytics")
    yolo_model: str = "yolov8n.pt"
    yolo_device: str = "auto"
    tracker_config: str = "bytetrack.yaml"
    confidence_threshold: float = Field(default=0.25, ge=0.05, le=0.95)
    image_size: int = Field(default=640, ge=320, le=1280)
    max_upload_mb: int = Field(default=200, ge=1, le=2048)
    max_video_seconds: int = Field(default=180, ge=5, le=3600)
    analytics_sample_every_n_frames: int = Field(default=5, ge=1, le=60)
    cors_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
