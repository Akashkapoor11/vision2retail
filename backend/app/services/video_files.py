from pathlib import Path
from uuid import uuid4

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def allowed_video_extension(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_VIDEO_EXTENSIONS


def make_upload_path(media_root: Path, filename: str) -> Path:
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_VIDEO_EXTENSIONS:
        raise ValueError("Unsupported video extension.")
    destination = media_root / "uploads" / f"{uuid4().hex}{extension}"
    destination.parent.mkdir(parents=True, exist_ok=True)
    return destination
