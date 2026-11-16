import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _id() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class VideoStatus:
    PENDING = "pending"
    UPLOADING = "uploading"
    TRANSCRIBING = "transcribing"
    TRANSCRIBED = "transcribed"
    ANALYZING = "analyzing"
    AWAITING_REVIEW = "awaiting_review"
    RENDERING = "rendering"
    COMPLETED = "completed"
    FAILED = "failed"


class JobStatus:
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    ACTIVE = (PENDING, RUNNING)


class ClipStatus:
    SUGGESTED = "suggested"
    APPROVED = "approved"
    REJECTED = "rejected"
    RENDERED = "rendered"


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    videos: Mapped[list["Video"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    jobs: Mapped[list["Job"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Video(Base):
    __tablename__ = "videos"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(300))  # nome original (apenas exibição)
    file_path: Mapped[str] = mapped_column(String(500))  # relativo a storage_dir
    proxy_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    duration: Mapped[float] = mapped_column(Float, default=0)
    resolution: Mapped[str] = mapped_column(String(20), default="")
    fps: Mapped[float] = mapped_column(Float, default=0)
    has_audio: Mapped[int] = mapped_column(Integer, default=1)
    hdr_transfer: Mapped[str | None] = mapped_column(String(30), nullable=True)  # HLG/PQ; None = SDR
    status: Mapped[str] = mapped_column(String(30), default=VideoStatus.PENDING, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    project: Mapped[Project] = relationship(back_populates="videos")
    transcript: Mapped["Transcript | None"] = relationship(
        back_populates="video", cascade="all, delete-orphan", uselist=False
    )
    clips: Mapped[list["Clip"]] = relationship(back_populates="video", cascade="all, delete-orphan")

    @property
    def has_preview(self) -> bool:
        return bool(self.proxy_path)

    @property
    def has_transcript(self) -> bool:
        return self.transcript is not None

    @property
    def hdr(self) -> bool:
        return bool(self.hdr_transfer)


class Transcript(Base):
    __tablename__ = "transcripts"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    video_id: Mapped[str] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), unique=True)
    language: Mapped[str] = mapped_column(String(10), default="")
    transcript_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    video: Mapped[Video] = relationship(back_populates="transcript")


class Clip(Base):
    __tablename__ = "clips"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    video_id: Mapped[str] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    hook: Mapped[str] = mapped_column(Text, default="")
    start_time: Mapped[float] = mapped_column(Float)
    end_time: Mapped[float] = mapped_column(Float)
    duration: Mapped[float] = mapped_column(Float)
    transcript: Mapped[str] = mapped_column(Text, default="")
    rationale: Mapped[str] = mapped_column(Text, default="")
    cta: Mapped[str] = mapped_column(Text, default="")
    editorial_score: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped[str] = mapped_column(String(60), default="")
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default=ClipStatus.SUGGESTED, index=True)
    render_options: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    video: Mapped[Video] = relationship(back_populates="clips")
    exports: Mapped[list["Export"]] = relationship(back_populates="clip", cascade="all, delete-orphan")


class Export(Base):
    __tablename__ = "exports"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    clip_id: Mapped[str] = mapped_column(ForeignKey("clips.id", ondelete="CASCADE"), index=True)
    file_path: Mapped[str] = mapped_column(String(500))
    format: Mapped[str] = mapped_column(String(30))  # preset: reels | shorts | tiktok
    resolution: Mapped[str] = mapped_column(String(20))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    clip: Mapped[Clip] = relationship(back_populates="exports")


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    video_id: Mapped[str | None] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), nullable=True)
    clip_id: Mapped[str | None] = mapped_column(ForeignKey("clips.id", ondelete="CASCADE"), nullable=True)
    job_type: Mapped[str] = mapped_column(String(30))  # process | transcribe | analyze | render
    status: Mapped[str] = mapped_column(String(20), default=JobStatus.PENDING, index=True)
    progress: Mapped[float] = mapped_column(Float, default=0)
    stage: Mapped[str] = mapped_column(String(60), default="")
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    cancel_requested: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    log: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    project: Mapped[Project] = relationship(back_populates="jobs")


class Setting(Base):
    """Chave/valor JSON: identidade do canal e presets de legenda customizados."""
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)
