"""Autenticação, dashboard, projetos, jobs, exportações e configurações."""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import jobs as jobq, render, security, storage, subtitles
from ..config import get_settings
from ..db import get_db
from ..deps import get_or_404
from ..models import Clip, Export, Job, JobStatus, Project, Setting, Video
from ..schemas import (BrandIn, ExportOut, JobDetail, JobOut, LoginIn, ProjectDetail, ProjectIn, ProjectOut,
                       ProjectPatch)

public = APIRouter(prefix="/api", tags=["auth"])
router = APIRouter(prefix="/api", dependencies=[Depends(security.require_auth)])


# ---------- auth ----------
@public.post("/auth/login")
def login(body: LoginIn, request: Request, response: Response):
    ip = request.client.host if request.client else "?"
    if security.login_blocked(ip):
        raise HTTPException(429, "Muitas tentativas de acesso. Aguarde alguns minutos e tente de novo.")
    ok = security.check_password(body.password)
    security.register_login(ip, ok)
    if not ok:
        raise HTTPException(401, "Senha incorreta.")
    s = get_settings()
    response.set_cookie(security.COOKIE, security.issue_token(), max_age=s.session_hours * 3600, httponly=True,
                        samesite="lax", secure=s.cookie_secure)
    return {"ok": True}


@public.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(security.COOKIE)
    return {"ok": True}


@router.get("/auth/me", tags=["auth"])
def me():
    return {"authenticated": True}


# ---------- projetos ----------
def _project_out(db: Session, p: Project, detail: bool = False):
    vids = db.query(Video).filter(Video.project_id == p.id).order_by(Video.created_at.desc()).all()
    ids = [v.id for v in vids]
    clips = db.query(func.count(Clip.id)).filter(Clip.video_id.in_(ids)).scalar() if ids else 0
    exports = (db.query(func.count(Export.id)).join(Clip).filter(Clip.video_id.in_(ids)).scalar() if ids else 0)
    data = dict(id=p.id, name=p.name, description=p.description, created_at=p.created_at, video_count=len(vids),
                clip_count=clips, export_count=exports)
    return ProjectDetail(**data, videos=vids) if detail else ProjectOut(**data)


@router.post("/projects", response_model=ProjectOut, status_code=201, tags=["projects"])
def create_project(body: ProjectIn, db: Session = Depends(get_db)):
    p = Project(name=body.name.strip(), description=body.description.strip())
    db.add(p)
    db.commit()
    return _project_out(db, p)


@router.get("/projects", response_model=list[ProjectOut], tags=["projects"])
def list_projects(db: Session = Depends(get_db)):
    return [_project_out(db, p) for p in db.query(Project).order_by(Project.created_at.desc()).all()]


@router.get("/projects/{project_id}", response_model=ProjectDetail, tags=["projects"])
def get_project(project_id: str, db: Session = Depends(get_db)):
    return _project_out(db, get_or_404(db, Project, project_id), detail=True)


@router.patch("/projects/{project_id}", response_model=ProjectOut, tags=["projects"])
def update_project(project_id: str, body: ProjectPatch, db: Session = Depends(get_db)):
    p = get_or_404(db, Project, project_id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v.strip())
    db.commit()
    return _project_out(db, p)


@router.delete("/projects/{project_id}", status_code=204, tags=["projects"])
def delete_project(project_id: str, db: Session = Depends(get_db)):
    p = get_or_404(db, Project, project_id)
    for j in db.query(Job).filter(Job.project_id == p.id, Job.status.in_(JobStatus.ACTIVE)).all():
        jobq.cancel(db, j)  # o worker percebe o registro ausente e interrompe o ffmpeg
    db.delete(p)
    db.commit()
    storage.delete_project_files(project_id)  # só depois do commit; restrito a data/projects/<id>


# ---------- jobs ----------
@router.get("/jobs", response_model=list[JobOut], tags=["jobs"])
def list_jobs(project_id: str | None = None, video_id: str | None = None, active: bool = False,
              limit: int = 50, db: Session = Depends(get_db)):
    q = db.query(Job)
    if project_id:
        q = q.filter(Job.project_id == project_id)
    if video_id:
        q = q.filter(Job.video_id == video_id)
    if active:
        q = q.filter(Job.status.in_(JobStatus.ACTIVE))
    return q.order_by(Job.created_at.desc()).limit(min(limit, 200)).all()


@router.get("/jobs/{job_id}", response_model=JobDetail, tags=["jobs"])
def get_job(job_id: str, db: Session = Depends(get_db)):
    return get_or_404(db, Job, job_id)


@router.post("/jobs/{job_id}/cancel", response_model=JobOut, tags=["jobs"])
def cancel_job(job_id: str, db: Session = Depends(get_db)):
    return jobq.cancel(db, get_or_404(db, Job, job_id))


# ---------- exportações ----------
def _export_out(e: Export) -> ExportOut:
    v = e.clip.video
    return ExportOut(id=e.id, clip_id=e.clip_id, format=e.format, resolution=e.resolution, size_bytes=e.size_bytes,
                     created_at=e.created_at, clip_title=e.clip.title, project_id=v.project_id,
                     project_name=v.project.name)


@router.get("/exports", response_model=list[ExportOut], tags=["exports"])
def list_exports(limit: int = 30, db: Session = Depends(get_db)):
    return [_export_out(e) for e in db.query(Export).order_by(Export.created_at.desc()).limit(min(limit, 200))]


@router.get("/exports/{export_id}/download", tags=["exports"])
def download_export(export_id: str, inline: bool = False, db: Session = Depends(get_db)):
    e = db.get(Export, export_id)
    if e is None:
        raise HTTPException(404, "Exportação não encontrada.")
    path = storage.resolve(e.file_path)
    if not path.is_file():
        raise HTTPException(410, "O arquivo exportado não está mais disponível.")
    name = storage.safe_display_name(f"{e.clip.title}_{e.format}.mp4")
    return FileResponse(path, media_type="video/mp4", filename=name,
                        content_disposition_type="inline" if inline else "attachment")


@router.delete("/exports/{export_id}", status_code=204, tags=["exports"])
def delete_export(export_id: str, db: Session = Depends(get_db)):
    e = db.get(Export, export_id)
    if e is None:
        raise HTTPException(404, "Exportação não encontrada.")
    path = e.file_path
    db.delete(e)
    db.commit()
    storage.remove(path)


# ---------- dashboard ----------
@router.get("/dashboard", tags=["dashboard"])
def dashboard(db: Session = Depends(get_db)):
    recent = db.query(Project).order_by(Project.created_at.desc()).limit(6).all()
    active = db.query(Job).filter(Job.status.in_(JobStatus.ACTIVE)).order_by(Job.created_at.desc()).all()
    return {
        "totals": {
            "projects": db.query(func.count(Project.id)).scalar(),
            "videos": db.query(func.count(Video.id)).scalar(),
            "clips": db.query(func.count(Clip.id)).scalar(),
            "exports": db.query(func.count(Export.id)).scalar(),
            "active_jobs": len(active),
        },
        "recent_projects": [_project_out(db, p) for p in recent],
        "active_jobs": [JobOut.model_validate(j) for j in active],
        "recent_exports": [_export_out(e) for e in db.query(Export).order_by(Export.created_at.desc()).limit(8)],
        "disk_free_gb": round(storage.free_bytes() / 1e9, 1),
    }


# ---------- configurações: identidade do canal e legendas ----------
def _get(db: Session, key: str, default: dict) -> dict:
    row = db.get(Setting, key)
    return dict(row.value) if row else default


def _put(db: Session, key: str, value: dict) -> None:
    row = db.get(Setting, key)
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))
    db.commit()


@router.get("/settings/brand", tags=["settings"])
def get_brand(db: Session = Depends(get_db)):
    b = _get(db, "brand", BrandIn().model_dump())
    return {**BrandIn(**{k: v for k, v in b.items() if k != "logo_path"}).model_dump(),
            "has_logo": bool(b.get("logo_path"))}


@router.put("/settings/brand", tags=["settings"])
def put_brand(body: BrandIn, db: Session = Depends(get_db)):
    current = _get(db, "brand", {})
    _put(db, "brand", {**body.model_dump(), "logo_path": current.get("logo_path")})
    return get_brand(db)


@router.post("/settings/brand/logo", tags=["settings"])
async def upload_logo(request: Request, db: Session = Depends(get_db)):
    """Corpo: PNG bruto (até 5 MB)."""
    data = b""
    async for chunk in request.stream():
        data += chunk
        if len(data) > 5 * 1024 * 1024:
            raise HTTPException(413, "Logo acima de 5 MB.")
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(415, "Envie o logo em PNG (de preferência com fundo transparente).")
    path = get_settings().brand_dir / "logo.png"
    path.write_bytes(data)
    _put(db, "brand", {**_get(db, "brand", BrandIn().model_dump()), "logo_path": storage.rel(path)})
    return {"ok": True}


@router.get("/settings/brand/logo", tags=["settings"])
def get_logo(db: Session = Depends(get_db)):
    rel = _get(db, "brand", {}).get("logo_path")
    if not rel or not storage.resolve(rel).is_file():
        raise HTTPException(404, "Nenhum logo configurado.")
    return FileResponse(storage.resolve(rel), media_type="image/png")


@router.delete("/settings/brand/logo", status_code=204, tags=["settings"])
def delete_logo(db: Session = Depends(get_db)):
    b = _get(db, "brand", {})
    storage.remove(b.get("logo_path"))
    _put(db, "brand", {**b, "logo_path": None})


@router.get("/settings/subtitles", tags=["settings"])
def get_subtitle_settings(db: Session = Depends(get_db)):
    return {
        "builtin": {k: v.model_dump() for k, v in subtitles.PRESETS.items()},
        "custom": _get(db, "subtitle_presets", {}),
        "fonts": subtitles.BUNDLED_FONTS,
        "render_presets": render.PRESETS,
    }


@router.put("/settings/subtitles/{name}", tags=["settings"])
def put_subtitle_preset(name: str, body: subtitles.SubtitleStyle, db: Session = Depends(get_db)):
    if name in subtitles.PRESETS or not name.replace("_", "").isalnum() or len(name) > 40:
        raise HTTPException(422, "Nome inválido ou reservado a um preset padrão.")
    if body.font not in subtitles.BUNDLED_FONTS:
        raise HTTPException(422, "Fonte não disponível.")
    _put(db, "subtitle_presets", {**_get(db, "subtitle_presets", {}), name: body.model_dump()})
    return get_subtitle_settings(db)


@router.delete("/settings/subtitles/{name}", tags=["settings"])
def delete_subtitle_preset(name: str, db: Session = Depends(get_db)):
    custom = _get(db, "subtitle_presets", {})
    custom.pop(name, None)
    _put(db, "subtitle_presets", custom)
    return get_subtitle_settings(db)
