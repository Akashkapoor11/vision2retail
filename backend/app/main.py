import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    (settings.media_root / "uploads").mkdir(parents=True, exist_ok=True)
    (settings.media_root / "processed").mkdir(parents=True, exist_ok=True)
    settings.yolo_config_dir.mkdir(parents=True, exist_ok=True)
    logger.info(
        "Vision2Retail API starting — env=%s model=%s device=%s",
        settings.environment,
        settings.yolo_model,
        settings.yolo_device,
    )
    yield


app = FastAPI(
    title=settings.app_name,
    description=(
        "**Vision2Retail** — Computer-vision retail video analysis API.\n\n"
        "Upload authorized store video clips and receive:\n"
        "- Object detections via YOLOv8\n"
        "- Multi-object tracking via ByteTrack\n"
        "- Per-frame people count estimates\n"
        "- Annotated output video and heatmap\n"
        "- Sampled activity timeline and track summaries\n\n"
        "> ⚠️ Do not expose this service publicly without authentication and deployment hardening."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "operations", "description": "Health probes and service metadata."},
        {"name": "videos", "description": "Upload video assets for analysis."},
        {"name": "jobs", "description": "Query processing job status and results."},
        {"name": "reports", "description": "Download annotated video and heatmap outputs."},
        {"name": "analytics", "description": "Timeline metrics, track summaries, and bounding-box observations."},
        {"name": "dashboard", "description": "Aggregated dashboard summary statistics."},
    ],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "PATCH", "HEAD", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
)
app.include_router(router)


@app.get("/healthz", tags=["operations"])
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "vision2retail-api"}


@app.get("/", tags=["operations"])
def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "health": "/healthz",
        "note": "Do not expose this demonstration service publicly without authentication and deployment hardening.",
    }
