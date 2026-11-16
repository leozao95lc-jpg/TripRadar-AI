"""Autenticação simples para uso privado: senha compartilhada -> token HMAC assinado,
entregue em cookie HttpOnly (o <video> do navegador não envia cabeçalhos) ou Bearer."""
import base64
import hashlib
import hmac
import time

from fastapi import HTTPException, Request

from .config import get_settings

COOKIE = "clipstudio_session"
_failures: dict[str, list[float]] = {}  # IP -> instantes das falhas recentes (memória do processo)
WINDOW_SECONDS = 600


def login_blocked(ip: str) -> bool:
    recent = [t for t in _failures.get(ip, []) if time.time() - t < WINDOW_SECONDS]
    _failures[ip] = recent
    return len(recent) >= get_settings().login_max_failures


def register_login(ip: str, ok: bool) -> None:
    if ok:
        _failures.pop(ip, None)
    else:
        _failures.setdefault(ip, []).append(time.time())


def _sign(payload: str) -> str:
    key = get_settings().secret_key.encode()
    return base64.urlsafe_b64encode(hmac.new(key, payload.encode(), hashlib.sha256).digest()).decode().rstrip("=")


def check_password(candidate: str) -> bool:
    expected = get_settings().app_password
    return bool(expected) and hmac.compare_digest(candidate.encode(), expected.encode())


def issue_token() -> str:
    exp = str(int(time.time()) + get_settings().session_hours * 3600)
    return f"{exp}.{_sign(exp)}"


def valid_token(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    exp, sig = token.split(".", 1)
    return exp.isdigit() and hmac.compare_digest(sig, _sign(exp)) and int(exp) > time.time()


def require_auth(request: Request) -> None:
    token = request.cookies.get(COOKIE)
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    if not valid_token(token):
        raise HTTPException(401, "Não autenticado.")
