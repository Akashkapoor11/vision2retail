"""Initial Vision2Retail schema."""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "video_assets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("stored_path", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(120), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "processing_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("video_id", sa.String(36), sa.ForeignKey("video_assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("stage", sa.String(100), nullable=False),
        sa.Column("progress_percent", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("source_fps", sa.Float(), nullable=True),
        sa.Column("total_frames", sa.Integer(), nullable=False),
        sa.Column("processed_frames", sa.Integer(), nullable=False),
        sa.Column("detections_count", sa.Integer(), nullable=False),
        sa.Column("unique_tracks_count", sa.Integer(), nullable=False),
        sa.Column("person_tracks_count", sa.Integer(), nullable=False),
        sa.Column("processing_fps", sa.Float(), nullable=True),
        sa.Column("output_video_path", sa.Text(), nullable=True),
        sa.Column("heatmap_path", sa.Text(), nullable=True),
        sa.Column("summary_json", sa.JSON(), nullable=True),
    )
    op.create_index("ix_processing_jobs_created_at", "processing_jobs", ["created_at"])
    op.create_table(
        "track_observations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("job_id", sa.String(36), sa.ForeignKey("processing_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("frame_index", sa.Integer(), nullable=False),
        sa.Column("timestamp_seconds", sa.Float(), nullable=False),
        sa.Column("track_id", sa.Integer(), nullable=True),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("class_name", sa.String(100), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("x1", sa.Float(), nullable=False),
        sa.Column("y1", sa.Float(), nullable=False),
        sa.Column("x2", sa.Float(), nullable=False),
        sa.Column("y2", sa.Float(), nullable=False),
    )
    op.create_index("ix_observations_job_frame", "track_observations", ["job_id", "frame_index"])
    op.create_table(
        "metric_points",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("job_id", sa.String(36), sa.ForeignKey("processing_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("frame_index", sa.Integer(), nullable=False),
        sa.Column("timestamp_seconds", sa.Float(), nullable=False),
        sa.Column("people_count", sa.Integer(), nullable=False),
        sa.Column("detection_count", sa.Integer(), nullable=False),
        sa.UniqueConstraint("job_id", "frame_index", name="uq_metric_job_frame"),
    )
    op.create_table(
        "track_summaries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("job_id", sa.String(36), sa.ForeignKey("processing_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("track_id", sa.Integer(), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("class_name", sa.String(100), nullable=False),
        sa.Column("first_seen_frame", sa.Integer(), nullable=False),
        sa.Column("last_seen_frame", sa.Integer(), nullable=False),
        sa.Column("frames_seen", sa.Integer(), nullable=False),
        sa.Column("average_confidence", sa.Float(), nullable=False),
        sa.Column("duration_seconds", sa.Float(), nullable=False),
        sa.UniqueConstraint("job_id", "track_id", "class_id", name="uq_track_job_id_class"),
    )


def downgrade() -> None:
    op.drop_table("track_summaries")
    op.drop_table("metric_points")
    op.drop_index("ix_observations_job_frame", table_name="track_observations")
    op.drop_table("track_observations")
    op.drop_index("ix_processing_jobs_created_at", table_name="processing_jobs")
    op.drop_table("processing_jobs")
    op.drop_table("video_assets")
