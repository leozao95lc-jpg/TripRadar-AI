"""Configuração central. Todos os segredos vêm exclusivamente de variáveis de ambiente / .env."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# Raiz do projeto (clip-studio-ai/). Dentro do container é "/", e STORAGE_DIR=/storage.
ROOT = Path(__file__).resolve().parents[2]

# storage/<área>/<id do projeto>/...  (cada projeto tem seus próprios arquivos em cada área)
AREAS = ("originals", "audio", "transcripts", "clips", "exports", "previews")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(ROOT / ".env", ".env"), env_file_encoding="utf-8", extra="ignore")

    # Armazenamento
    storage_dir: Path = ROOT / "storage"
    database_url: str = ""  # vazio => sqlite em storage_dir/clipstudio.db
    max_upload_mb: int = 8192
    min_free_disk_mb: int = 2048  # folga exigida além do tamanho do arquivo

    # Autenticação (ferramenta privada: senha compartilhada + cookie assinado)
    app_password: str = ""
    secret_key: str = ""
    session_hours: int = 24 * 7
    login_max_failures: int = 8  # por IP, a cada 10 minutos
    cors_origins: str = "http://localhost:3000"
    cookie_secure: bool = False

    # Fila
    redis_url: str = "redis://localhost:6379/0"
    queue_eager: bool = False  # True => executa os jobs de forma síncrona (testes/dev sem Redis)
    job_max_attempts: int = 2
    job_timeout_seconds: int = 6 * 3600

    # Transcrição
    whisper_model: str = "large-v3-turbo"  # melhor relação qualidade/tempo medida (ver README)
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
        return self.database_url or f"sqlite:///{(self.storage_dir / 'clipstudio.db').resolve()}"

    @property
    def tmp_dir(self) -> Path:
        return self.storage_dir / "temp"

    @property
    def brand_dir(self) -> Path:
        return self.storage_dir / "brand"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    for d in (s.storage_dir, s.tmp_dir, s.brand_dir, *(s.storage_dir / a for a in AREAS)):
        d.mkdir(parents=True, exist_ok=True)
    return s
