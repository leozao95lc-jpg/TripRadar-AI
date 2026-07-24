from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware

from bootstrap import register_event_handlers
from modules.admin.interface.routes import router as admin_router
from modules.alerts.interface.routes import router as alerts_router
from modules.feature_flags.interface.routes import router as feature_flags_router
from modules.identity.interface.oauth import router as identity_oauth_router
from modules.identity.interface.routes import me_router as identity_me_router
from modules.identity.interface.routes import router as identity_router
from modules.notifications.interface.routes import router as notifications_router
from modules.observability.infrastructure.repository import SqlAlchemyWorkerRunRepository
from modules.price_monitoring.interface.routes import router as price_monitoring_router
from modules.recommendations.interface.routes import router as recommendations_router
from shared.config import settings
from shared.database import get_db
from shared.logging import configure_logging, get_logger
from shared.metrics import CONTENT_TYPE_LATEST, refresh_worker_gauges, render_metrics
from shared.middleware import RequestContextMiddleware

configure_logging(settings.environment, settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    register_event_handlers()
    logger.info("api_startup", environment=settings.environment, flight_provider=settings.flight_provider)
    yield


app = FastAPI(
    title="TripRadar AI API",
    version="0.1.0",
    description="Monitoramento inteligente de preços de passagens aéreas.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SessionMiddleware, secret_key=settings.session_secret_key)
app.add_middleware(RequestContextMiddleware)

app.include_router(identity_router)
app.include_router(identity_me_router)
app.include_router(identity_oauth_router)
app.include_router(price_monitoring_router)
app.include_router(alerts_router)
app.include_router(notifications_router)
app.include_router(recommendations_router)
app.include_router(feature_flags_router)
app.include_router(admin_router)


@app.get("/health", tags=["ops"])
def health() -> dict:
    """Liveness: o processo está de pé. Não toca banco nem nenhuma dependência
    externa — não pode falhar por causa de outra coisa que não seja o próprio
    processo travado."""
    return {"status": "ok", "environment": settings.environment}


@app.get("/health/ready", tags=["ops"])
def health_ready(response: Response, db: Session = Depends(get_db)) -> dict:
    """Readiness: o processo está de pé E consegue falar com o banco. Usado pelo
    orquestrador para decidir se a instância deve receber tráfego — diferente de
    `/health`, este pode (e deve) retornar 503 quando a dependência crítica está
    fora. Usa `Depends(get_db)` como qualquer outra rota (não uma sessão própria
    fora de banda) — mesma unidade de trabalho, mesma forma de trocar por um fake
    em teste."""
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("health_ready_check_failed")
        response.status_code = 503
        return {"status": "unavailable", "database": "unreachable"}
    return {"status": "ok", "database": "reachable"}


@app.get("/metrics", tags=["ops"])
def metrics(db: Session = Depends(get_db)) -> Response:
    """Formato de exposição Prometheus. Sem autenticação própria — em produção a
    exposição deve ser restrita por rede, não por credencial de aplicação (ver
    `shared/metrics.py`)."""
    refresh_worker_gauges(SqlAlchemyWorkerRunRepository(db).list_latest_per_worker())
    return Response(content=render_metrics(), media_type=CONTENT_TYPE_LATEST)
