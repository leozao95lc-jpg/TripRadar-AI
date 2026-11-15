"""Configuração central. Todos os segredos vêm exclusivamente de variáveis de ambiente / .env."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Armazenamento
    data_dir: Path = Path("./data")
    database_url: str = ""  # vazio => sqlite em data_dir/clipstudio.db
    max_upload_mb: int = 8192
    min_free_disk_mb: int = 2048  # folga exigida além do tamanho do arquivo

    # Autenticação (ferramenta privada: senha compartilhada + cookie assinado)
    app_password: str = ""
    secret_key: str = ""
    session_hours: int = 24 * 7
    cors_origins: str = "http://localhost:3000"
    cookie_secure: bool = False

    # Fila
    redis_url: str = "redis://localhost:6379/0"
    queue_eager: bool = False  # True => executa os jobs de forma síncrona (testes/dev sem Redis)
    job_max_attempts: int = 2
    job_timeout_seconds: int = 6 * 3600

    # Transcrição
    whisper_model: str = "small"
    whisper_device: str = "auto"
    whisper_compute_type: str = "int8"

    # IA editorial
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5-5"
    anthropic_effort: str = "high"

    # Render
    ffmpeg_bin: str = "ffmpeg"
    ffprobe_bin: str = "ffprobe"
    render_crf: int = 18
    render_preset: str = "medium"

    @property
    def db_url(self) -> str:
        return self.database_url or f"sqlite:///{(self.data_dir / 'clipstudio.db').resolve()}"

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"

    @property
    def tmp_dir(self) -> Path:
        return self.data_dir / "tmp"

    @property
    def brand_dir(self) -> Path:
        return self.data_dir / "brand"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    for d in (s.data_dir, s.projects_dir, s.tmp_dir, s.brand_dir):
        d.mkdir(parents=True, exist_ok=True)
    return s
