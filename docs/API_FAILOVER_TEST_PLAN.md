# API-first and fallback test plan

## Expected request order

1. Every live request starts with `NEXT_PUBLIC_API_URL`.
2. For safe GET/read operations only, a network failure or HTTP 5xx triggers the optional `NEXT_PUBLIC_API_FALLBACK_URL`.
3. If no live read API responds, supported dashboard/list/known-demo-report GETs can return synthetic fixtures. The UI must show the demo-data banner.
4. HTTP 4xx responses are not hidden, except a 404 for a known `demo-...` fixture ID.
5. Upload POST requests do not auto-retry against the secondary API and never return fake success. This avoids duplicate jobs if the primary server accepted the request before the network response was lost.
6. Demo jobs do not claim annotated-video or heatmap files exist.

## Automated mocked-fetch checks completed

- Primary API success returns live response and sets source mode to `primary`.
- Primary network failure plus configured secondary API success returns the secondary response and sets source mode to `secondary`.
- Primary network failure with no secondary API returns the synthetic dashboard fixture and sets source mode to `demo`.
- Upload network failure rejects with an actionable error and makes one request only; no demo success or cross-host retry occurs.

These tests validate frontend request policy with mocked fetch responses. They do not replace running the two APIs, CORS checks, browser tests, or a complete Docker deployment.

## Manual live test matrix

| Scenario | Expected result |
|---|---|
| Primary API healthy | Live dashboard/job data; no fallback warning |
| Primary down, secondary healthy | Secondary API data; yellow secondary API banner |
| Both API hosts down | Synthetic fixtures for supported GETs; prominent demo/sample-data banner |
| Upload with API down | Clear failure message; no fake job created |
| Real job ID returns 404 | Real 404 error; no random demo job substituted |
| Demo fixture ID opened | Clearly labeled synthetic report; no fake video/heatmap request |
| API recovers after demo mode | Primary data returns and demo banner clears |
| Secondary API used for media | Video/image URLs point at the last successful secondary API host |
