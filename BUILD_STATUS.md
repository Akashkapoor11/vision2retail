# Vision2Retail — Build and Validation Status

**Last audited:** 27 October 2026

## Passed in this environment

- API-first frontend request policy added: primary API, optional secondary API for read-only transient failures, then clearly labeled synthetic GET fixtures. Uploads fail closed and are never faked.
- Six API fallback behavior checks passed using mocked browser fetch responses: primary success preferred, secondary host used before demo, offline GET enters demo mode, known demo ID resolves, real 404 remains visible, and upload does not retry or fake success.
- All 10 frontend TypeScript/TSX files passed syntax transpilation after the API fallback changes.

- Python `compileall`: passed.
- Python AST parsing: 25/25 Python files passed.
- Backend tests: `python -m pytest -q` — **25 passed**.
- TypeScript/TSX syntax transpilation: 10/10 files passed using globally installed TypeScript. This is not a full TypeScript typecheck.
- Frontend JSON manifests parse successfully.
- Docker Compose YAML parses successfully.
- Project ZIP CRC check passes.
- Source-level fixes in the latest audit: retry job-status fetch after transient initial API errors; stop retrying on 404; restrict picker extensions to formats accepted by the backend.

## Not validated

- The tests ran on Python 3.13.5 with preinstalled FastAPI 0.128.2, not the Docker target Python 3.12 with `fastapi==0.156.4` from requirements.
- Ruff is configured and declared as a dev dependency, but executable was unavailable; no Ruff result is claimed.
- Docker build / Compose start and real API-worker-PostgreSQL-Redis integration were not run because Docker is unavailable.
- npm dependency installation failed in the prior attempt due DNS/network errors. Full TypeScript typecheck, ESLint, `next build`, lockfile generation and browser testing have not been completed.
- The worker test uses fake model outputs with real OpenCV video I/O; actual YOLOv8/ByteTrack inference with downloaded weights was not run.
- Accuracy/tracking metrics, throughput on target hardware, security review and business-impact claims are not validated.

## Release gates

1. Generate and commit `package-lock.json`; use `npm ci` and run `npm run typecheck`, `npm run lint`, and `npm run build`.
2. Build and run the Compose stack in a network-enabled environment.
3. Process an authorized real clip and verify annotated MP4 playback, heatmap, database rows, API responses and frontend metrics.
4. Run backend tests/Ruff in the target Python 3.12 image with the declared dependency set.
5. Measure actual detection/tracking quality on a representative labelled set before making numeric claims.
6. Add authentication, authorization, rate limits, TLS, retention controls and monitoring before any public/untrusted deployment.

This package is a portfolio/demo implementation, not a certified production release or guaranteed competition winner. The code was assembled after the 14 October 2026 Zeta Innovate cutoff shared by the user; do not misrepresent its implementation date.

## API-first / fallback policy

Frontend read requests go to the primary FastAPI service first. A configured `NEXT_PUBLIC_API_FALLBACK_URL` is attempted only after transient transport/5xx errors. If no live API is available, supported read-only dashboard/report endpoints return visibly labeled synthetic demo fixtures. Uploads and other mutations never return mock success and do not auto-retry to another API host. Live model inference remains local in the Celery worker; no third-party hosted inference API is used.
