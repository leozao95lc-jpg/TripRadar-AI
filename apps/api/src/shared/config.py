from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração central da aplicação, lida de variáveis de ambiente (.env em dev)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    log_level: str = "INFO"

    database_url: str = "postgresql+psycopg://tripradar:tripradar@localhost:5432/tripradar"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret_key: str = "change-me-in-production"
    session_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    google_oauth_redirect_url: str = "http://localhost:8000/api/v1/auth/oauth/google/callback"

    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str = "alerts@tripradar.ai"
    smtp_use_tls: bool = False

    whatsapp_cloud_api_token: str | None = None
    whatsapp_phone_number_id: str | None = None
    whatsapp_api_base_url: str = "https://graph.facebook.com/v20.0"

    flight_provider: str = "mock"  # "mock" | "amadeus"
    amadeus_api_key: str | None = None
    amadeus_api_secret: str | None = None
    amadeus_base_url: str = "https://test.api.amadeus.com"

    price_polling_batch_size: int = 50
    price_drop_alert_threshold_pct: float = 5.0

    cors_allow_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
