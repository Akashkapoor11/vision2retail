# Zeta Innovate preparation plan — Vision2Retail

## Eligibility gate (do this first)

The candidate information shared in the conversation says the solution must have been fully implemented by **14 October 2026**. This implementation was assembled on **21 October 2026**, after that cutoff. It must not be represented as having existed before the cutoff. Use it for portfolio development or ask TCS support for a written eligibility clarification. If there is a different genuine, fully implemented project from before the cutoff, evaluate that project instead.

## Proposed domain and title

- Domain: AI/ML/GenAI → AI/ML, computer vision
- Title: **Vision2Retail: AI-Powered Retail Store Intelligence**
- Thesis: transform authorized video into explainable detection and tracking outputs with a traceable end-to-end software pipeline.

## Differentiator to prove

Do not claim novelty merely because the stack contains YOLOv8, ByteTrack, FastAPI and PostgreSQL. Show a working flow from clip upload through inference, sampled data persistence and dashboard reporting. Add an evaluation table from an actual test set. If a meaningful novel retail-specific insight is not currently implemented and eligible, describe it only as future work.

## Judge-facing evidence bundle

1. A concise problem statement with a grounded use case.
2. Architecture diagram matching the actual code.
3. Screenshots of a real inference output, dashboard, stored records and generated heatmap.
4. Reproducibility card: model weights, tracker config, confidence threshold, frame sampling, hardware, video resolution and test conditions.
5. Evaluation table with clearly defined measurements and repeatable methodology.
6. Limitations and privacy posture.
7. A live demo plus a backup recording, only if allowed by the candidate guide.

## Measurements to collect honestly

- Runtime and throughput on stated hardware, with video dimensions, FPS and processed seconds.
- Detection precision/recall/mAP only when labels exist and the metric protocol is defined.
- Tracking metrics such as IDF1 only when ground-truth trajectories exist.
- Output consistency between API, database and UI.
- Failure cases, including crowded frames, occlusion, glare and low light.

Never manufacture accuracy, latency, ROI or business outcomes. Label every synthetic or sample value explicitly if used for UI testing.

## Timebox for a future eligible project / portfolio delivery

- Day 1: audit eligibility, repository history, dependencies, and feature claims.
- Day 2: freeze environment and reproduce the build.
- Days 3–4: test pipeline, fix defects, and collect metrics.
- Day 5: architecture/data-flow diagram and methodology notes.
- Day 6: prepare demo path, fallback recording and judge Q&A.
- Day 7: verify official submission rules, privacy, deliverable formats and project dates.

For the current Zeta Innovate submission, follow the official candidate guide rather than treating this post-cutoff schedule as a way to bypass the cutoff.
