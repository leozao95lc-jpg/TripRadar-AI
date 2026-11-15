import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import storage
from .config import get_settings
from .routers import core, media

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    if not s.app_password or len(s.secret_key) < 32:
        raise RuntimeError("Defina APP_PASSWORD e SECRET_KEY (32+ caracteres) no .env antes de iniciar.")
    storage.cleanup_partial_uploads()
    yield


app = FastAPI(
    title="CLIP STUDIO AI",
    version="0.1.0",
    description="Transforma vídeos longos em cortes verticais para Reels, Shorts e TikTok. "
                "Autentique em POST /api/auth/login; a sessão vai em cookie HttpOnly (ou Bearer).",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)
app.include_router(core.public)
app.include_router(core.router)
app.include_router(media.router)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}
