from app.core.config import Settings


def test_cors_origins_are_split_and_trimmed() -> None:
    config = Settings(cors_origins="http://localhost:3000, https://demo.example")
    assert config.cors_origin_list == ["http://localhost:3000", "https://demo.example"]
