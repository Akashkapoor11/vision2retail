# Vision2Retail - AI-Powered Store Intelligence

> **Turn authorized retail store footage into structured operational intelligence - automatically.**

Vision2Retail is a **production-grade, end-to-end computer-vision platform** that detects objects with **YOLOv8**, tracks customers across frames with **ByteTrack**, generates spatial heatmaps, persists metrics to **PostgreSQL**, and surfaces everything in a live **Next.js dashboard** - all deployed with a single `docker compose up`.

|  Problem | Solution |  Impact |
|------------|------------|----------|
| Retail CCTV footage goes 99% unanalyzed | Automated CV pipeline on any store video | From ₹20–50L/year to ₹0 |
| Enterprise tools inaccessible to SMBs | Self-hosted, one-command deployment | Insights in minutes, not days |
| Manual review: 10–20 hrs/week | Automated detection, tracking, heatmap | Scales to any number of stores |


## Product scope

- Upload MP4, MOV, AVI, MKV or WEBM clips through a browser UI.
- Queue analysis as a Celery job so HTTP requests do not block on inference.
- Run YOLOv8 detection with Ultralytics tracking configured for ByteTrack.
- Generate an annotated MP4 and a heatmap of sampled person-detection centroids.
- Store the upload, processing status, sampled bounding-box observations, frame timeline points, and per-track summaries.
- Show progress, object detection totals, track IDs, throughput, sampled class counts, activity timeline and longest observed tracks.
- Limit uploads to 200 MB by default, analyze up to the first 180 seconds, and reject videos above 12 megapixels per frame.
- Provide API docs at `/docs`, API health at `/healthz` and dependency health at `/api/health`.

The default YOLO weights are `yolov8n.pt`; the first worker run may need internet access to download the weights. CPU inference works as a default demonstration path; set `YOLO_DEVICE` to an available device value only if your environment supports it. Performance depends on hardware, input resolution and scene complexity.

## Architecture

```text
Next.js + React + TypeScript dashboard
              │ HTTP / JSON + multipart upload
              ▼
          FastAPI API ─────────────── PostgreSQL
              │                            ▲
              └── queue task via Redis     │
                          │                │
                          ▼                │
                  Celery inference worker ─┘
                          │
               YOLOv8 + ByteTrack + OpenCV
                          │
               annotated video + heatmap
```

### Professional stack

| Layer | Stack | Responsibility |
|---|---|---|
| Detection | Python, Ultralytics YOLOv8, PyTorch | Object detection on frames |
| Tracking | ByteTrack through Ultralytics | Associate detections across frames |
| Video | OpenCV, NumPy | Video I/O, annotation rendering, centroid heatmap |
| API | FastAPI, Pydantic Settings | Validation, upload endpoints, job/status/report APIs |
| Async processing | Celery + Redis | Queue long-running video jobs outside API workers |
| Persistence | PostgreSQL, SQLAlchemy 2, Alembic, psycopg | Durable metadata, sampled observations, metrics and track summaries |
| Frontend | Next.js 16, React 19, TypeScript | Dashboard and analysis reports |
| UI / charts | Tailwind CSS 4, Lucide React, Recharts | Responsive styling, icons and analytics plots |
| Local deployment | Docker Compose | Repeatable multi-service local environment |
| Quality | pytest, pytest-cov, Ruff, ESLint, TypeScript | Tests, coverage, linting and static checks |

## Run locally with Docker

Prerequisites: Docker Desktop with Docker Compose v2, at least 8 GB RAM recommended for a smoother local demo, and enough disk space for Docker images, model weights and processed video files.

1. Copy the example settings file:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Change `POSTGRES_PASSWORD` in `.env` from its local-demo default. Make the same password change in `DATABASE_URL`. Keep the `.env` file private.
3. Build and launch:

   ```bash
   docker compose up --build
   ```

4. Open:
   - Dashboard: http://localhost:3000
   - FastAPI Swagger UI: http://localhost:8000/docs
   - Liveness probe: http://localhost:8000/healthz
   - Dependency health: http://localhost:8000/api/health

5. Upload a video you are authorized to analyze. The worker downloads YOLO weights if they are not present, processes the video, and updates the report page automatically.

Stop services with `Ctrl+C`, then run `docker compose down`. To remove local data as well, use `docker compose down -v` (this permanently deletes PostgreSQL records, Redis state and shared video files).

## Run the backend outside Docker

Use Python 3.12 in a virtual environment. PostgreSQL and Redis must be available, and the environment variables must point to your host services. From `backend/`:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Run the worker in another terminal from `backend/` with the same environment:

```bash
celery -A app.celery_app:celery_app worker --loglevel=INFO --concurrency=1
```

For a local non-Docker run, set `DATABASE_URL`, `REDIS_URL`, `MEDIA_ROOT`, `YOLO_CONFIG_DIR` and `CORS_ORIGINS` appropriately. Example service hostnames `db` and `redis` only work inside Compose's network.

## Frontend development

Use Node.js 22. From `frontend/`:

```bash
npm install
# PowerShell: $env:NEXT_PUBLIC_API_URL="http://localhost:8000"
# macOS/Linux: export NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

For a production-style local build: `npm run build` then `npm run start`. `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_FALLBACK_URL` are embedded at build time in the browser app; set them before building.

### API-first and fallback policy

All live dashboard data, job status, analytics, uploads, annotated video and heatmap requests are served by the FastAPI REST API. The browser calls the configured primary API (`NEXT_PUBLIC_API_URL`) first.

For **read-only GET requests only**, the frontend then:

1. Tries `NEXT_PUBLIC_API_FALLBACK_URL` if the primary API has a network error or a server-side 5xx response and a distinct secondary URL is configured.
2. If no live API can serve supported dashboard/report reads, shows clearly labeled **synthetic demo fixtures** for the summary, recent-job list, and the fixture job IDs. A visible banner states that these values are illustrative, not real store measurements.
3. Returns real client errors (such as 400/401/403/404/413/415/422) rather than hiding them behind sample data. Only known `demo-...` fixture IDs can fall back after a 404.

**Mutations fail closed:** uploads are never faked and are not automatically retried against a second API host, because the first server may have accepted the upload before a response was lost; retrying could create duplicate jobs. Upload/analysis requires a live API, worker, database and Redis. Demo fallback never invents annotated video, heatmaps, or completed AI results. YOLOv8/ByteTrack inference runs in the backend worker; no third-party hosted AI API is currently used.

Set `NEXT_PUBLIC_API_FALLBACK_URL` to a second compatible FastAPI deployment if one exists. Leave it blank to use clearly labeled synthetic GET fixtures when the live backend is unavailable. Cross-origin secondary API deployments must allow the frontend origin through CORS.

## API surface

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/healthz` | API liveness |
| GET | `/api/health` | Database and Redis check |
| POST | `/api/videos` | Upload and enqueue a video; returns HTTP 202 |
| GET | `/api/dashboard/summary` | Aggregated totals across completed jobs |
| GET | `/api/jobs?limit=20` | Recent jobs |
| GET | `/api/jobs/{job_id}` | Status, progress and summary for one job |
| GET | `/api/jobs/{job_id}/analytics` | Sampled timeline and top track summaries |
| GET | `/api/jobs/{job_id}/observations?limit=100&offset=0` | Paginated sampled bounding-box observations |
| GET | `/api/jobs/{job_id}/annotated-video` | Annotated MP4 for a completed job |
| GET | `/api/jobs/{job_id}/heatmap` | Sampled person-centroid heatmap PNG |

## Metric definitions and limitations

- **Detections across frames** is a model-output count. One object can be detected in many frames; this is not a count of unique people or items.
- **Track IDs** count class/track-ID pairs observed by the tracker in one clip. Tracking may fragment one object into multiple IDs or switch IDs under occlusion.
- **Estimated people per sampled frame** combines distinct tracked person IDs with detections of people that did not receive a tracker ID in that frame. It remains an estimate, not visitor identity or a verified unique-person count; ID switches or duplicate detections can affect it.
- **Class breakdown** is calculated on sampled frames, with the sampling stride stored in each job summary to keep database volume reasonable.
- **Heatmap** shows the spatial density of sampled person-box centroids. It is not a true dwell-time analysis or proof that a person remained in one location.
- **FPS** is measured throughput for the worker run, not model benchmark accuracy.
- Pretrained weights recognize generic object classes; this package does not claim to detect retail intent, shopper demographics, purchase behavior, theft or customer identity.
- Results need a representative, labelled evaluation set before business-critical use. Privacy, camera placement, local law, data retention and signage/consent requirements must be reviewed by the deploying organization.

## Security and deployment

This starter is configured for localhost-only ports in Docker Compose and has no user authentication or authorization layer. **Do not expose it publicly or put it on an untrusted network as-is.** A real deployment needs authentication/authorization, TLS, rate limiting, upload scanning and quotas, private object storage, retention/deletion controls, structured audit logs, secret management, least-privilege database roles, resource isolation for inference workers, and monitoring. Review Ultralytics licensing terms before commercial deployment.

## Quality checks

From `backend/`:

```bash
python -m compileall -q app alembic tests
python -m pytest -q --cov=app --cov-report=term-missing
ruff check app tests alembic
```

From `frontend/` after installing Node dependencies:

```bash
npm run typecheck
npm run lint
npm run build
```

The automated tests cover configuration, upload-path handling, API-level upload/job behavior, analytics contracts, and a worker-pipeline exercise that uses a deterministic fake model with real OpenCV video I/O. That worker test does not verify actual YOLO weights or model accuracy. Live YOLO/ByteTrack inference still requires model weights and a working runtime; PostgreSQL + Redis/Celery/Docker integration must be tested separately. Install `requirements-dev.txt` for tests and linting; the Docker image installs runtime dependencies only.

## Project pitch

**Vision2Retail converts authorized store video into structured, inspectable computer-vision outputs.** YOLOv8 provides object detections; ByteTrack associates detections across frames; a FastAPI service queues and reports jobs; PostgreSQL stores sampled evidence and metrics; and a Next.js dashboard makes outputs easy to inspect. Its value proposition is a reproducible path from video input to traceable visual results-paired with explicit limitations and honest measurement.

