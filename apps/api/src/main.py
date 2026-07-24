from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from bootstrap import register_event_handlers
from modules.alerts.interface.routes import router as alerts_router
from modules.identity.interface.oauth import router as identity_oauth_router
from modules.identity.interface.routes import me_router as identity_me_router
from modules.identity.interface.routes import router as identity_router
from modules.notifications.interface.routes import router as notifications_router
from modules.price_monitoring.interface.routes import router as price_monitoring_router
from modules.recommendations.interface.routes import router as recommendations_router
from shared.config import settings
from shared.logging import configure_logging, get_logger
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


@app.get("/health", tags=["ops"])
def health() -> dict:
    return {"status": "ok", "environment": settings.environment}
