import pytest

from app.services.analytics import estimate_people_in_frame


def test_estimated_people_count_deduplicates_tracked_ids_and_adds_untracked_detections() -> None:
    # Same tracker ID appearing twice is counted once; each untracked person detection adds one.
    assert estimate_people_in_frame({12, 12, 21}, 2) == 4


def test_estimated_people_count_handles_no_tracks() -> None:
    assert estimate_people_in_frame(set(), 3) == 3


def test_estimated_people_count_handles_all_tracked() -> None:
    assert estimate_people_in_frame({5, 8}, 0) == 2


def test_estimated_people_count_rejects_negative_untracked_count() -> None:
    with pytest.raises(ValueError, match="non-negative"):
        estimate_people_in_frame({1}, -1)
