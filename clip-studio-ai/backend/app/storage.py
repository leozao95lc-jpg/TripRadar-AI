"""Sistema de arquivos local: storage/<área>/<projeto>/. Todo caminho passa por `resolve`,
que impede path traversal (nada fora de storage_dir é lido ou apagado)."""
import re
import shutil
import time
from pathlib import Path

from .config import AREAS, get_settings
from .errors import AppError

ALLOWED_EXT = {".mp4", ".mov", ".m4v"}


class StorageError(AppError):
    pass


def resolve(rel: str | Path) -> Path:
    root = get_settings().storage_dir.resolve()
    p = (root / rel).resolve()
    if p != root and root not in p.parents:
        raise StorageError("Caminho fora da área de armazenamento.")
    return p


def rel(path: Path) -> str:
    return str(path.resolve().relative_to(get_settings().storage_dir.resolve()))


def area(kind: str, project_id: str) -> Path:
    """storage/<kind>/<project_id>/ — criado sob demanda."""
    if kind not in AREAS:
        raise StorageError("Área de armazenamento inválida.")
    if not re.fullmatch(r"[0-9a-f]{32}", project_id):
        raise StorageError("ID de projeto inválido.")
    d = resolve(Path(kind) / project_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def safe_display_name(name: str) -> str:
    name = Path(name.replace("\\", "/")).name
    name = re.sub(r"[^\w.\- ()]", "_", name, flags=re.UNICODE).strip(" .")
    return name[:200] or "video"


def free_bytes() -> int:
    return shutil.disk_usage(get_settings().storage_dir).free


def ensure_space(needed: int) -> None:
    s = get_settings()
    if free_bytes() < needed + s.min_free_disk_mb * 1024 * 1024:
        raise StorageError("Espaço em disco insuficiente para concluir a operação.")


def delete_project_files(project_id: str) -> None:
    """Exclusão segura: só remove storage/<área>/<id>, com o ID validado."""
    if not re.fullmatch(r"[0-9a-f]{32}", project_id):
        raise StorageError("ID de projeto inválido.")
    for kind in AREAS:
        d = resolve(Path(kind) / project_id)
        if d.is_dir() and d.parent == resolve(kind):
            shutil.rmtree(d, ignore_errors=True)


def remove(rel_path: str | None) -> None:
    if rel_path:
        resolve(rel_path).unlink(missing_ok=True)


def cleanup_tmp() -> int:
    """Remove diretórios de trabalho órfãos de jobs (áudio extraído, .ass, render parcial)."""
    n = 0
    for p in get_settings().tmp_dir.glob("job_*"):
        shutil.rmtree(p, ignore_errors=True)
        n += 1
    return n


def cleanup_partial_uploads(max_age_hours: float = 24) -> int:
    """Remove uploads abortados (.part) antigos."""
    n, limit = 0, time.time() - max_age_hours * 3600
    for p in resolve("originals").glob("*/*.part"):
        if p.stat().st_mtime < limit:
            p.unlink(missing_ok=True)
            n += 1
    return n
