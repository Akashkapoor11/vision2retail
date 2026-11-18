# Demonstration script (target: 2–3 minutes; adjust to official guide)

> Use only a version that is eligible under the event rules. Do not present this post-cutoff implementation as a pre-cutoff build.

**0:00–0:20 — Problem**  
“Reviewing store video manually can be time-consuming. Vision2Retail demonstrates how video can be transformed into structured detections and traceable outputs for further analysis.”

**0:20–0:55 — Upload and process**  
Select an authorized sample clip. Show the new job and its real processing status. Explain that long-running inference is queued through Redis/Celery instead of blocking the API request.

**0:55–1:30 — Computer vision**  
Open the annotated video. Explain that YOLOv8 detects supported object classes, while ByteTrack associates detections across frames where tracking succeeds. Call out one real example and one difficult case.

**1:30–2:00 — End-to-end engineering**  
Show the generated heatmap, activity timeline, track summaries and backend/database records. Clarify which values are full-frame totals and which are sampled-frame analytics.

**2:00–2:30 — Evidence and limitations**  
Present the measured run configuration and genuine results. State that track IDs are not verified unique customers and that the heatmap reflects sampled person-box centroids, not calibrated dwell time.

**2:30–2:45 — Impact**  
“By making model outputs inspectable and reproducible, the system provides a foundation for retail analytics. Any deployment would require representative validation, privacy review, and production security controls.”

## Likely judge questions

- **Why YOLOv8?** It is the chosen detector in this build; justify based on actual speed/quality measurements from the tested model rather than claiming it is universally best.
- **Why ByteTrack?** It provides a lightweight baseline for associating detections across frames; explain observed ID fragmentation and occlusion failures.
- **How accurate is it?** Answer only with metrics from a documented labelled evaluation. Otherwise say formal model accuracy has not yet been measured.
- **Does it count unique customers?** No. Track IDs are scoped to the clip and may fragment or switch.
- **Can it scale?** The queue/worker design separates API requests from inference and provides a foundation for scaling; this local demo has not proven production-scale throughput.
- **What is innovative?** Show the specific end-to-end workflow and validated insight that is genuinely distinctive; do not equate a large technology list with innovation.
