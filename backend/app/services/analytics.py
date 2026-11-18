"""Pure analytics helpers shared by the worker and unit tests."""


def estimate_people_in_frame(tracked_person_ids: set[int], untracked_person_detections: int) -> int:
    """Estimate people visible in one frame without double-counting tracked IDs.

    One detection with no tracker ID is counted as one person detection. A tracked
    person is counted once per distinct ID. This remains an estimate, not a unique-
    customer count; tracker ID switches can still split one person into multiple IDs.
    """
    if untracked_person_detections < 0:
        raise ValueError("untracked_person_detections must be non-negative")
    return len(tracked_person_ids) + untracked_person_detections
