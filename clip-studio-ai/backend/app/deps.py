from fastapi import HTTPException

from .models import Clip, Job, JobStatus, Project, Video


def get_or_404(db, model, id_: str):
    obj = db.get(model, id_)
    if obj is None:
        names = {Project: "Projeto", Video: "Vídeo", Clip: "Corte", Job: "Trabalho"}
        raise HTTPException(404, f"{names.get(model, 'Registro')} não encontrado.")
    return obj


def ensure_no_active_job(db, *, video_id: str | None = None, clip_id: str | None = None,
                         include_renders: bool = False) -> None:
    """Um job por vídeo (transcrição/análise) e um por corte (render). `include_renders` cobre
    operações destrutivas no vídeo, que não podem acontecer com nenhum job dele em andamento."""
    q = db.query(Job).filter(Job.status.in_(JobStatus.ACTIVE))
    if clip_id:
        q = q.filter(Job.clip_id == clip_id)
    elif include_renders:
        q = q.filter(Job.video_id == video_id)
    else:
        q = q.filter(Job.video_id == video_id, Job.clip_id.is_(None))
    if q.first():
        raise HTTPException(409, "Já existe um processamento em andamento para este item.")
