"""Upload, vídeos, transcrição, análise, cortes e renderização."""
import uuid
from urllib.parse import quote
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from starlette.requests import ClientDisconnect

from .. import jobs as jobq, media, security, storage
from ..config import get_settings
from ..db import get_db
from ..deps import ensure_no_active_job, get_or_404
from ..models import Clip, ClipStatus, Project, Transcript, Video, VideoStatus
from ..render import RenderOptions
from ..schemas import (AnalyzeIn, ClipCreate, ClipOut, ClipPatch, JobOut, ProcessIn, TranscribeIn, VideoOut)
from ..subtitles import BUNDLED_FONTS, clip_words, to_srt

router = APIRouter(prefix="/api", dependencies=[Depends(security.require_auth)])
# Átomos de topo válidos em arquivos ISO-BMFF / QuickTime (MP4, M4V, MOV)
MAGIC = {b"ftyp", b"moov", b"mdat", b"wide", b"free", b"skip"}
CHUNK_LIMIT_MSG = "Arquivo acima do limite de {} MB."
FLUSH_BYTES = 4 * 1024 * 1024


# ---------- upload ----------
@router.post("/projects/{project_id}/videos", response_model=VideoOut, status_code=201, tags=["videos"],
             openapi_extra={"requestBody": {"required": True, "content": {
                 "application/octet-stream": {"schema": {"type": "string", "format": "binary"}}}}})
async def upload_video(project_id: str, filename: str, request: Request, db: Session = Depends(get_db)):
    """Upload por streaming: o corpo da requisição é o arquivo bruto (application/octet-stream),
    gravado em disco em blocos. Nada é mantido em memória."""
    s = get_settings()
    project = get_or_404(db, Project, project_id)
    display = storage.safe_display_name(filename)
    ext = Path(display).suffix.lower()
    if ext not in storage.ALLOWED_EXT:
        raise HTTPException(415, "Formato não aceito. Envie MP4, MOV ou M4V.")
    declared = int(request.headers.get("content-length") or 0)
    if declared > s.max_upload_bytes:
        raise HTTPException(413, CHUNK_LIMIT_MSG.format(s.max_upload_mb))
    try:
        storage.ensure_space(declared)
    except storage.StorageError as e:
        raise HTTPException(507, str(e))
    video_id = uuid.uuid4().hex
    vdir = storage.area("originals", project.id)
    part, final = vdir / f"{video_id}.part", vdir / f"{video_id}{ext}"
    size, head, buf = 0, b"", bytearray()

    async def flush(f) -> None:
        nonlocal buf
        data, buf = buf, bytearray()
        await run_in_threadpool(f.write, data)  # disco fora do event loop: a API segue respondendo
        if storage.free_bytes() < s.min_free_disk_mb * 1024 * 1024:
            raise HTTPException(507, "Espaço em disco insuficiente para concluir o upload.")

    try:
        with part.open("wb") as f:
            async for chunk in request.stream():
                size += len(chunk)
                if size > s.max_upload_bytes:
                    raise HTTPException(413, CHUNK_LIMIT_MSG.format(s.max_upload_mb))
                if len(head) < 12:
                    head += chunk[:12 - len(head)]
                buf += chunk
                if len(buf) >= FLUSH_BYTES:  # no máximo alguns MB em memória, qualquer que seja o arquivo
                    await flush(f)
            await flush(f)
        if size == 0:
            raise HTTPException(400, "Arquivo vazio.")
        if len(head) < 12 or head[4:8] not in MAGIC:
            raise HTTPException(415, "O conteúdo do arquivo não corresponde a um vídeo MP4/MOV/M4V.")
        try:
            info = await run_in_threadpool(media.probe, part)
        except media.MediaError as e:
            raise HTTPException(415, str(e))
        part.replace(final)
    except ClientDisconnect:
        part.unlink(missing_ok=True)
        raise HTTPException(499, "Upload interrompido.")
    except BaseException:
        part.unlink(missing_ok=True)
        raise
    video = Video(id=video_id, project_id=project.id, filename=display, file_path=storage.rel(final),
                  size_bytes=size, duration=info["duration"], resolution=f"{info['width']}x{info['height']}",
                  fps=info["fps"], has_audio=int(info["has_audio"]), hdr_transfer=info["hdr_transfer"],
                  status=VideoStatus.PENDING)
    db.add(video)
    db.commit()
    return video


# ---------- vídeos ----------
@router.get("/videos/{video_id}", response_model=VideoOut, tags=["videos"])
def get_video(video_id: str, db: Session = Depends(get_db)):
    return get_or_404(db, Video, video_id)


@router.delete("/videos/{video_id}", status_code=204, tags=["videos"])
def delete_video(video_id: str, db: Session = Depends(get_db)):
    v = get_or_404(db, Video, video_id)
    ensure_no_active_job(db, video_id=v.id, include_renders=True)
    paths = [v.file_path, v.proxy_path, *(e.file_path for c in v.clips for e in c.exports)]
    tdir, adir = storage.area("transcripts", v.project_id), storage.area("audio", v.project_id)
    cdir = storage.area("clips", v.project_id)
    clip_ids = [c.id for c in v.clips]
    db.delete(v)
    db.commit()
    for p in paths:
        storage.remove(p)
    for ext in ("json", "srt"):
        (tdir / f"{video_id}.{ext}").unlink(missing_ok=True)
    (adir / f"{video_id}.wav").unlink(missing_ok=True)
    for cid in clip_ids:
        for ext in ("ass", "srt"):
            (cdir / f"{cid}.{ext}").unlink(missing_ok=True)


@router.get("/videos/{video_id}/stream", tags=["videos"])
def stream_video(video_id: str, db: Session = Depends(get_db)):
    """Player de revisão (suporta Range). Exige sessão; o original nunca fica em URL pública."""
    v = get_or_404(db, Video, video_id)
    path = storage.resolve(v.proxy_path or v.file_path)
    if not path.is_file():
        raise HTTPException(410, "Arquivo de vídeo indisponível.")
    return FileResponse(path, media_type="video/mp4" if path.suffix != ".mov" else "video/quicktime")


def _start(db: Session, v: Video, job_type: str, params: dict) -> JobOut:
    ensure_no_active_job(db, video_id=v.id)
    job = jobq.create_job(db, v.project_id, job_type, video_id=v.id, params=params)
    jobq.enqueue(job.id)
    db.refresh(job)
    return job


@router.post("/videos/{video_id}/process", response_model=JobOut, status_code=202, tags=["pipeline"])
def process_video(video_id: str, body: ProcessIn = ProcessIn(), db: Session = Depends(get_db)):
    """Pipeline completo: transcrição + análise editorial. Para na revisão; nada é renderizado sem aprovação."""
    return _start(db, get_or_404(db, Video, video_id), "process", body.model_dump())


@router.post("/videos/{video_id}/transcribe", response_model=JobOut, status_code=202, tags=["pipeline"])
def transcribe_video(video_id: str, body: TranscribeIn = TranscribeIn(), db: Session = Depends(get_db)):
    return _start(db, get_or_404(db, Video, video_id), "transcribe", body.model_dump())


@router.post("/videos/{video_id}/analyze", response_model=JobOut, status_code=202, tags=["pipeline"])
def analyze_video(video_id: str, body: AnalyzeIn = AnalyzeIn(), db: Session = Depends(get_db)):
    """Nova análise: substitui sugestões ainda não revisadas; cortes aprovados/renderizados são mantidos."""
    v = get_or_404(db, Video, video_id)
    if v.transcript is None:
        raise HTTPException(409, "Transcreva o vídeo antes de solicitar a análise editorial.")
    return _start(db, v, "analyze", body.model_dump())


@router.get("/videos/{video_id}/transcript", tags=["pipeline"])
def get_transcript(video_id: str, format: str = "json", db: Session = Depends(get_db)):
    v = get_or_404(db, Video, video_id)
    if v.transcript is None:
        raise HTTPException(404, "Este vídeo ainda não foi transcrito.")
    if format == "srt":
        name = quote(Path(v.filename).stem + ".srt")  # RFC 5987: nomes com acento
        return PlainTextResponse(to_srt(v.transcript.transcript_json["segments"]), media_type="application/x-subrip",
                                 headers={"Content-Disposition": f"attachment; filename*=UTF-8''{name}"})
    return {"language": v.transcript.language, **v.transcript.transcript_json}


# ---------- cortes ----------
def _segments(db: Session, video_id: str) -> list[dict]:
    t = db.query(Transcript).filter(Transcript.video_id == video_id).first()
    return t.transcript_json.get("segments", []) if t else []


def _text_between(segments: list[dict], start: float, end: float) -> str:
    """Texto falado dentro do intervalo, com precisão de palavra (cortes ajustados à mão)."""
    return " ".join(w["word"] for w in clip_words(segments, start, end))


def _check_range(v: Video, start: float, end: float) -> None:
    if end > v.duration + 0.05:
        raise HTTPException(422, f"O fim do corte ultrapassa a duração do vídeo ({v.duration:.1f}s).")
    if end - start < 1:
        raise HTTPException(422, "O corte precisa ter pelo menos 1 segundo e o fim deve vir depois do início.")


@router.get("/videos/{video_id}/clips", response_model=list[ClipOut], tags=["clips"])
def list_clips(video_id: str, db: Session = Depends(get_db)):
    get_or_404(db, Video, video_id)
    return db.query(Clip).filter(Clip.video_id == video_id).order_by(Clip.editorial_score.desc(), Clip.start_time).all()


@router.post("/videos/{video_id}/clips", response_model=ClipOut, status_code=201, tags=["clips"])
def create_clip(video_id: str, body: ClipCreate, db: Session = Depends(get_db)):
    """Corte manual, definido pelo usuário (sem pontuação editorial)."""
    v = get_or_404(db, Video, video_id)
    _check_range(v, body.start_time, body.end_time)
    end = min(body.end_time, v.duration)
    clip = Clip(video_id=v.id, title=body.title, start_time=body.start_time, end_time=end,
                duration=round(end - body.start_time, 3), category="outro",
                transcript=_text_between(_segments(db, v.id), body.start_time, end),
                rationale="Corte criado manualmente.", warnings=[])
    if v.status in (VideoStatus.PENDING, VideoStatus.TRANSCRIBED, VideoStatus.FAILED):
        v.status = VideoStatus.AWAITING_REVIEW
    db.add(clip)
    db.commit()
    return clip


@router.patch("/clips/{clip_id}", response_model=ClipOut, tags=["clips"])
def update_clip(clip_id: str, body: ClipPatch, db: Session = Depends(get_db)):
    clip = get_or_404(db, Clip, clip_id)
    data = body.model_dump(exclude_none=True)
    if "start_time" in data or "end_time" in data:
        ensure_no_active_job(db, clip_id=clip.id)
        start, end = data.get("start_time", clip.start_time), data.get("end_time", clip.end_time)
        _check_range(clip.video, start, end)
        end = min(end, clip.video.duration)
        changed = abs(start - clip.start_time) > 1e-3 or abs(end - clip.end_time) > 1e-3
        clip.start_time, clip.end_time, clip.duration = start, end, round(end - start, 3)
        if changed:
            clip.transcript = _text_between(_segments(db, clip.video_id), start, end)
            clip.warnings = ["Tempos ajustados manualmente."]
            if clip.status == ClipStatus.RENDERED:
                clip.status = ClipStatus.APPROVED  # exportação anterior não reflete mais o corte
    for k in ("title", "hook", "cta", "status"):
        if k in data:
            setattr(clip, k, data[k])
    db.commit()
    return clip


@router.get("/clips/{clip_id}/srt", tags=["clips"])
def clip_srt(clip_id: str, db: Session = Depends(get_db)):
    """Legenda do corte em SRT (tempos relativos ao início do corte), para subir como caption nas redes."""
    clip = get_or_404(db, Clip, clip_id)
    srt = to_srt(_segments(db, clip.video_id), clip.start_time, clip.end_time)
    if not srt:
        raise HTTPException(404, "Não há transcrição para este corte.")
    name = quote(storage.safe_display_name(clip.title) + ".srt")
    return PlainTextResponse(srt, media_type="application/x-subrip",
                             headers={"Content-Disposition": f"attachment; filename*=UTF-8''{name}"})


@router.delete("/clips/{clip_id}", status_code=204, tags=["clips"])
def delete_clip(clip_id: str, db: Session = Depends(get_db)):
    clip = get_or_404(db, Clip, clip_id)
    ensure_no_active_job(db, clip_id=clip.id)
    paths = [e.file_path for e in clip.exports]
    cdir = storage.area("clips", clip.video.project_id)
    db.delete(clip)
    db.commit()
    for p in paths:
        storage.remove(p)
    for ext in ("ass", "srt"):
        (cdir / f"{clip_id}.{ext}").unlink(missing_ok=True)


@router.post("/clips/{clip_id}/render", response_model=JobOut, status_code=202, tags=["clips"])
def render_clip(clip_id: str, body: RenderOptions = RenderOptions(), db: Session = Depends(get_db)):
    """Só renderiza cortes aprovados. Chamar de novo gera uma nova exportação (\"gerar novamente\")."""
    clip = get_or_404(db, Clip, clip_id)
    if clip.status not in (ClipStatus.APPROVED, ClipStatus.RENDERED):
        raise HTTPException(409, "Aprove o corte antes de renderizar.")
    if body.subtitle_style and body.subtitle_style.font not in BUNDLED_FONTS:
        raise HTTPException(422, "Fonte não disponível.")
    ensure_no_active_job(db, clip_id=clip.id)
    job = jobq.create_job(db, clip.video.project_id, "render", video_id=clip.video_id, clip_id=clip.id,
                          params=body.model_dump())
    jobq.enqueue(job.id)
    db.refresh(job)
    return job
