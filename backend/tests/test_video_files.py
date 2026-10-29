from pathlib import Path

import pytest

from app.services.video_files import allowed_video_extension, make_upload_path


@pytest.mark.parametrize("filename", ["shop.mp4", "sample.MOV", "clip.avi", "a.mkv", "x.webm"])
def test_allowed_video_extension(filename: str) -> None:
    assert allowed_video_extension(filename)


@pytest.mark.parametrize("filename", ["invoice.pdf", "script.py", "movie.mp4.exe", "no-extension"])
def test_disallowed_video_extension(filename: str) -> None:
    assert not allowed_video_extension(filename)


def test_make_upload_path_uses_generated_name_and_creates_directory(tmp_path: Path) -> None:
    path = make_upload_path(tmp_path, "../../sensitive-name.MP4")
    assert path.parent == tmp_path / "uploads"
    assert path.name.endswith(".mp4")
    assert "sensitive-name" not in path.name
    assert path.parent.is_dir()


def test_make_upload_path_rejects_invalid_extension(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        make_upload_path(tmp_path, "payload.exe")
