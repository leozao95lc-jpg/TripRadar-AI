from fastapi import HTTPException

from .models import Clip, Job, JobStatus, Project, Video


def get_or_404(db, model, id_: str):
    obj = db.get(model, id_)
    if obj is None:
        names = {Project: "Projeto", Video: "Vídeo", Clip: "Corte", Job: "Trabalho"}
        raise HTTPException(404, f"{names.get(model, 'Registro')} não encontrado.")
    return obj


def ensure_no_active_job(db, *, video_id: str | None = None, clip_id: str | None = None) -> None:
    q = db.query(Job).filter(Job.status.in_(JobStatus.ACTIVE))
    q = q.filter(Job.clip_id == clip_id) if clip_id else q.filter(Job.video_id == video_id, Job.clip_id.is_(None))
    if q.first():
        raise HTTPException(409, "Já existe um processamento em andamento para este item.")
