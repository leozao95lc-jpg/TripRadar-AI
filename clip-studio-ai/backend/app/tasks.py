"""Handlers dos jobs. Cada um é idempotente: reexecutar não duplica dados."""
import json
import shutil
import time

from . import editorial, media, render, storage, transcription
from .db import SessionLocal
from .errors import AppError
from .jobs import JobContext
from .models import Clip, ClipStatus, Export, Job, Setting, Transcript, Video, VideoStatus
from .subtitles import to_srt

BROWSER_SAFE = {"h264"}


def status_after_stop(video_id: str | None, previous: str | None, failed: bool = False) -> str:
    """Status de repouso do vídeo após cancelamento/falha, conforme o que já existe."""
    if not video_id:
        return previous or VideoStatus.PENDING
    with SessionLocal() as db:
        v = db.get(Video, video_id)
        if v is None:
            return VideoStatus.FAILED
        if any(c.exports for c in v.clips):
            return VideoStatus.COMPLETED
        if v.clips:
            return VideoStatus.AWAITING_REVIEW
        if v.transcript:
            return VideoStatus.TRANSCRIBED
        return VideoStatus.FAILED if failed else VideoStatus.PENDING


def _load(ctx: JobContext):
    with SessionLocal() as db:
        job = db.get(Job, ctx.job_id)
        video = db.get(Video, job.video_id) if job.video_id else None
        if job.video_id and video is None:
            raise AppError("O vídeo deste trabalho não existe mais.")
        return job, video


def _set_status(video_id: str, status: str) -> None:
    with SessionLocal() as db:
        db.query(Video).filter(Video.id == video_id).update({"status": status})
        db.commit()


def _brand() -> dict:
    with SessionLocal() as db:
        row = db.get(Setting, "brand")
        return dict(row.value) if row else {}


def _custom_presets() -> dict:
    with SessionLocal() as db:
        row = db.get(Setting, "subtitle_presets")
        return dict(row.value) if row else {}


# ---------- transcrição ----------
def _transcribe(ctx: JobContext, video: Video, params: dict, lo: float, hi: float) -> dict:
    _set_status(video.id, VideoStatus.TRANSCRIBING)
    src = storage.resolve(video.file_path)
    info = media.probe(src)
    kw = {"should_cancel": ctx.cancelled}
    a, b = lo + (hi - lo) * 0.05, lo + (hi - lo) * 0.25
    if not video.proxy_path and (info["video_codec"] not in BROWSER_SAFE or src.suffix.lower() == ".mov"):
        ctx.progress(lo, "Gerando versão de visualização")
        proxy = storage.area("previews", video.project_id) / f"{video.id}.mp4"
        media.make_proxy(src, proxy, video.duration, info["hdr_transfer"], on_progress=ctx.span(lo, a), **kw)
        with SessionLocal() as db:
            db.query(Video).filter(Video.id == video.id).update({"proxy_path": storage.rel(proxy)})
            db.commit()
    if not info["has_audio"]:
        raise AppError("O vídeo não possui faixa de áudio; não há o que transcrever.")
    wav = storage.area("audio", video.project_id) / f"{video.id}.wav"
    if not wav.is_file():  # reaproveitado em novas transcrições do mesmo vídeo
        ctx.progress(a, "Extraindo áudio")
        storage.ensure_space(int(video.duration * 32000) + 1024)
        part = ctx.work_dir / "audio.wav"
        media.extract_audio(src, part, video.duration, on_progress=ctx.span(a, b), **kw)
        shutil.move(part, wav)
    ctx.progress(b, "Transcrevendo")
    result = transcription.transcribe(wav, video.duration, params.get("language") or None,
                                      on_progress=ctx.span(b, hi), should_cancel=ctx.cancelled)
    if not result["segments"]:
        raise AppError("Nenhuma fala foi detectada no vídeo.")
    ctx.check_cancel()  # projeto/vídeo excluído durante a transcrição: não grava nada
    tdir = storage.area("transcripts", video.project_id)
    (tdir / f"{video.id}.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    (tdir / f"{video.id}.srt").write_text(to_srt(result["segments"]), encoding="utf-8")
    with SessionLocal() as db:
        db.query(Transcript).filter(Transcript.video_id == video.id).delete()
        db.add(Transcript(video_id=video.id, language=result["language"], transcript_json=result))
        db.query(Video).filter(Video.id == video.id).update({"status": VideoStatus.TRANSCRIBED})
        db.commit()
    ctx.log(f"Transcrição concluída: {len(result['segments'])} segmentos, idioma {result['language']}")
    return result


# ---------- análise editorial ----------
def _analyze(ctx: JobContext, video: Video, params: dict, lo: float) -> None:
    with SessionLocal() as db:
        t = db.query(Transcript).filter(Transcript.video_id == video.id).first()
        if t is None:
            raise AppError("Transcreva o vídeo antes de solicitar a análise editorial.")
        transcript = t.transcript_json
        # aprovados, renderizados e rejeitados: decisões do usuário, não voltam como sugestão
        kept = db.query(Clip).filter(Clip.video_id == video.id, Clip.status != ClipStatus.SUGGESTED).all()
        exclude = [(c.start_time, c.end_time) for c in kept]
    _set_status(video.id, VideoStatus.ANALYZING)
    ctx.progress(lo, "Análise editorial (IA)")
    cfg = editorial.AnalysisConfig(**(params.get("analysis") or {}))
    brand = _brand()
    context = " — ".join(x for x in (brand.get("channel_name"), brand.get("channel_description")) if x)
    ctx.log("Enviando à API Claude apenas a transcrição (texto e timestamps).")
    suggestions = editorial.analyze(transcript, video.duration, cfg, context, exclude)
    ctx.check_cancel()
    with SessionLocal() as db:
        # nova análise substitui apenas sugestões não revisadas; aprovados/renderizados são preservados
        db.query(Clip).filter(Clip.video_id == video.id, Clip.status == ClipStatus.SUGGESTED).delete()
        for s in suggestions:
            db.add(Clip(video_id=video.id, **s.model_dump()))
        db.query(Video).filter(Video.id == video.id).update({"status": VideoStatus.AWAITING_REVIEW})
        db.commit()
    ctx.log(f"{len(suggestions)} cortes sugeridos" + (
        f" (abaixo do mínimo pedido de {cfg.min_clips}: o material não sustentou mais trechos com qualidade)"
        if len(suggestions) < cfg.min_clips else ""))


def handle_transcribe(ctx: JobContext) -> None:
    job, video = _load(ctx)
    _transcribe(ctx, video, job.params, 0.0, 1.0)


def handle_analyze(ctx: JobContext) -> None:
    job, video = _load(ctx)
    _analyze(ctx, video, job.params, 0.1)


def handle_process(ctx: JobContext) -> None:
    """Pipeline completo: extração de áudio -> transcrição -> análise -> aguardando revisão."""
    job, video = _load(ctx)
    _transcribe(ctx, video, job.params, 0.0, 0.85)
    ctx.check_cancel()
    _analyze(ctx, video, job.params, 0.86)


# ---------- renderização ----------
def handle_render(ctx: JobContext) -> None:
    job, video = _load(ctx)
    with SessionLocal() as db:
        clip = db.get(Clip, job.clip_id)
        if clip is None:
            raise AppError("O corte deste trabalho não existe mais.")
        if clip.status not in (ClipStatus.APPROVED, ClipStatus.RENDERED):
            raise AppError("O corte precisa ser aprovado antes da renderização.")
        t = db.query(Transcript).filter(Transcript.video_id == video.id).first()
        segments = t.transcript_json.get("segments", []) if t else []
        start, end = clip.start_time, clip.end_time
    opts = render.RenderOptions(**(job.params or {}))
    _set_status(video.id, VideoStatus.RENDERING)
    src = storage.resolve(video.file_path)
    w, h = (int(x) for x in video.resolution.split("x"))
    storage.ensure_space(int((end - start) * 2_500_000))
    out_dir = storage.area("exports", video.project_id)
    dst = out_dir / f"{job.clip_id}_{opts.preset}_{int(time.time())}.mp4"
    brand = _brand()
    logo = storage.resolve(brand["logo_path"]) if brand.get("logo_path") else None
    args, warnings = render.build(src, ctx.work_dir / "out.mp4", start, end, opts, w, h, bool(video.has_audio),
                                  segments, ctx.work_dir, logo, _custom_presets(), video.hdr_transfer)
    for msg in warnings:
        ctx.log(f"Aviso: {msg}")
    ctx.progress(0.02, "Renderizando")
    media.run_ffmpeg(args, end - start, on_progress=ctx.span(0.02, 0.98), should_cancel=ctx.cancelled)
    ctx.check_cancel()
    shutil.move(ctx.work_dir / "out.mp4", dst)  # só aparece em exports/ quando está completo
    cdir = storage.area("clips", video.project_id)  # artefatos do corte: legenda queimada (.ass) e .srt
    if (ctx.work_dir / "subs.ass").is_file():
        shutil.copy(ctx.work_dir / "subs.ass", cdir / f"{job.clip_id}.ass")
    clip_srt = to_srt(segments, start, end)
    if clip_srt:
        (cdir / f"{job.clip_id}.srt").write_text(clip_srt, encoding="utf-8")
    p = render.PRESETS[opts.preset]
    with SessionLocal() as db:
        db.add(Export(clip_id=job.clip_id, file_path=storage.rel(dst), format=opts.preset,
                      resolution=f"{p['width']}x{p['height']}", size_bytes=dst.stat().st_size))
        db.query(Clip).filter(Clip.id == job.clip_id).update(
            {"status": ClipStatus.RENDERED, "render_options": opts.model_dump()})
        db.query(Video).filter(Video.id == video.id).update({"status": VideoStatus.COMPLETED})
        db.commit()
    ctx.log(f"Exportado: {dst.name}")


HANDLERS = {"transcribe": handle_transcribe, "analyze": handle_analyze, "process": handle_process,
            "render": handle_render}
