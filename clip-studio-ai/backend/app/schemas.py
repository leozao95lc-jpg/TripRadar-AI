from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, computed_field

from .editorial import AnalysisConfig


def _utc(d: datetime) -> datetime:
    return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d


# Sem isso o navegador interpretaria os horários como locais (3 h de erro no Brasil).
UTCDateTime = Annotated[datetime, AfterValidator(_utc)]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginIn(BaseModel):
    password: str


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field("", max_length=5000)


class ProjectPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=5000)


class VideoOut(ORM):
    id: str
    project_id: str
    filename: str
    size_bytes: int
    duration: float
    resolution: str
    fps: float
    has_audio: bool
    has_preview: bool
    has_transcript: bool
    hdr: bool
    status: str
    created_at: UTCDateTime


class ProjectOut(ORM):
    id: str
    name: str
    description: str
    created_at: UTCDateTime
    video_count: int = 0
    clip_count: int = 0
    export_count: int = 0


class ProjectDetail(ProjectOut):
    videos: list[VideoOut] = []


class ExportOut(ORM):
    id: str
    clip_id: str
    format: str
    resolution: str
    size_bytes: int
    created_at: UTCDateTime
    clip_title: str = ""
    project_id: str = ""
    project_name: str = ""


class ClipOut(ORM):
    id: str
    video_id: str
    title: str
    hook: str
    start_time: float
    end_time: float
    duration: float
    transcript: str
    rationale: str
    cta: str
    editorial_score: int
    category: str
    warnings: list[str]
    status: str
    render_options: dict
    exports: list[ExportOut] = []


class ClipPatch(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    hook: str | None = None
    cta: str | None = None
    start_time: float | None = Field(None, ge=0)
    end_time: float | None = Field(None, gt=0)
    status: str | None = Field(None, pattern="^(suggested|approved|rejected)$")


class ClipCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    start_time: float = Field(ge=0)
    end_time: float = Field(gt=0)


class ProcessIn(BaseModel):
    language: str | None = Field(None, pattern="^(pt|es)$")  # None = detecção automática
    analysis: AnalysisConfig = AnalysisConfig()


class TranscribeIn(BaseModel):
    language: str | None = Field(None, pattern="^(pt|es)$")


class AnalyzeIn(BaseModel):
    analysis: AnalysisConfig = AnalysisConfig()


class JobOut(ORM):
    id: str
    project_id: str
    video_id: str | None
    clip_id: str | None
    job_type: str
    status: str
    progress: float
    stage: str
    attempts: int
    error_message: str | None
    created_at: UTCDateTime
    updated_at: UTCDateTime

    @computed_field
    @property
    def elapsed_seconds(self) -> float:
        end = datetime.now(timezone.utc) if self.status in ("pending", "running") else self.updated_at
        return round(max(0.0, (end - self.created_at).total_seconds()), 1)


class JobDetail(JobOut):
    log: str


class BrandIn(BaseModel):
    channel_name: str = Field("De Mala y Cuia", max_length=120)
    channel_description: str = Field("", max_length=1000)
    primary_color: str = Field("#1F3D2B", pattern="^#[0-9A-Fa-f]{6}$")
    accent_color: str = Field("#E8622C", pattern="^#[0-9A-Fa-f]{6}$")
    default_subtitle_preset: str = "de_mala_y_cuia"
