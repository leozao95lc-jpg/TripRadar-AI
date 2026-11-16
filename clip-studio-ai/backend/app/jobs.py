"""Fila de trabalhos (Redis + RQ) com estado espelhado no banco.

O registro `Job` no SQLite é a fonte de verdade para a interface: status, progresso,
etapa, log, tentativas e pedido de cancelamento. O ID do job no RQ é o mesmo do banco.
"""
import logging
import shutil
import time
import traceback
from datetime import datetime, timezone

from .config import get_settings
from .db import SessionLocal
from .errors import AppError
from .media import Cancelled
from .models import Job, JobStatus, Video, VideoStatus

log = logging.getLogger("clipstudio.jobs")
QUEUE = "clipstudio"


def _queue():
    from redis import Redis
    from rq import Queue

    return Queue(QUEUE, connection=Redis.from_url(get_settings().redis_url))


def enqueue(job_id: str) -> None:
    s = get_settings()
    if s.queue_eager:
        run_job(job_id)
        return
    from rq import Retry

    _queue().enqueue(run_job, job_id, job_id=job_id, job_timeout=s.job_timeout_seconds,
                     retry=Retry(max=max(0, s.job_max_attempts - 1), interval=15), result_ttl=3600,
                     failure_ttl=7 * 86400)


def create_job(db, project_id: str, job_type: str, video_id: str | None = None, clip_id: str | None = None,
               params: dict | None = None) -> Job:
    job = Job(project_id=project_id, job_type=job_type, video_id=video_id, clip_id=clip_id, params=params or {})
    db.add(job)
    db.commit()
    return job


class JobContext:
    """Passado aos handlers para reportar progresso, registrar log e checar cancelamento."""

    def __init__(self, job_id: str):
        self.job_id = job_id
        self._last = 0.0

    def _update(self, **fields) -> None:
        with SessionLocal() as db:
            db.query(Job).filter(Job.id == self.job_id).update(fields)
            db.commit()

    def progress(self, value: float, stage: str | None = None) -> None:
        if stage is None and time.time() - self._last < 1.0:
            return  # evita escrever no banco a cada frame
        self._last = time.time()
        fields = {"progress": round(max(0.0, min(1.0, value)), 4), "updated_at": datetime.now(timezone.utc)}
        if stage is not None:
            fields["stage"] = stage
            self.log(stage)
        self._update(**fields)

    def span(self, lo: float, hi: float):
        return lambda p: self.progress(lo + (hi - lo) * p)

    def log(self, message: str) -> None:
        log.info("[%s] %s", self.job_id, message)
        line = f"{datetime.now(timezone.utc).strftime('%H:%M:%S')} {message}\n"
        with SessionLocal() as db:
            job = db.get(Job, self.job_id)
            if job:
                job.log = (job.log + line)[-20000:]
                db.commit()

    def cancelled(self) -> bool:
        with SessionLocal() as db:
            job = db.get(Job, self.job_id)
            return job is None or bool(job.cancel_requested)

    def check_cancel(self) -> None:
        if self.cancelled():
            raise Cancelled()

    @property
    def work_dir(self):
        d = get_settings().tmp_dir / f"job_{self.job_id}"
        d.mkdir(parents=True, exist_ok=True)
        return d


def _set_video_status(video_id: str | None, status: str) -> None:
    if not video_id:
        return
    with SessionLocal() as db:
        db.query(Video).filter(Video.id == video_id).update({"status": status})
        db.commit()


def run_job(job_id: str) -> None:
    from . import tasks

    with SessionLocal() as db:
        job = db.get(Job, job_id)
        if job is None or job.status in (JobStatus.COMPLETED, JobStatus.CANCELLED):
            return
        if job.cancel_requested:
            job.status = JobStatus.CANCELLED
            db.commit()
            return
        job.status, job.attempts, job.error_message = JobStatus.RUNNING, job.attempts + 1, None
        db.commit()
        attempts, job_type, video_id = job.attempts, job.job_type, job.video_id
        prev_video_status = db.get(Video, video_id).status if video_id else None
    ctx = JobContext(job_id)
    ctx.log(f"Iniciando {job_type} (tentativa {attempts})")
    final: dict = {}
    try:
        tasks.HANDLERS[job_type](ctx)
        final = {"status": JobStatus.COMPLETED, "progress": 1.0, "stage": "Concluído"}
    except Cancelled:
        ctx.log("Cancelado pelo usuário")
        final = {"status": JobStatus.CANCELLED, "stage": "Cancelado"}
        _set_video_status(video_id, tasks.status_after_stop(video_id, prev_video_status))
    except AppError as e:  # erro de negócio: mensagem clara, sem nova tentativa
        ctx.log(f"Falha: {e}")
        final = {"status": JobStatus.FAILED, "error_message": str(e), "stage": "Falhou"}
        _set_video_status(video_id, tasks.status_after_stop(video_id, prev_video_status, failed=True))
    except Exception as e:  # inesperado: nova tentativa controlada
        ctx.log("Erro inesperado:\n" + traceback.format_exc()[-3000:])
        if attempts < get_settings().job_max_attempts and not get_settings().queue_eager:
            ctx._update(status=JobStatus.PENDING, stage="Aguardando nova tentativa")
            raise
        final = {"status": JobStatus.FAILED, "stage": "Falhou",
                 "error_message": f"Erro inesperado ao processar ({type(e).__name__}). Consulte o log do job."}
        _set_video_status(video_id, tasks.status_after_stop(video_id, prev_video_status, failed=True))
    finally:
        shutil.rmtree(get_settings().tmp_dir / f"job_{job_id}", ignore_errors=True)
        if final:
            ctx._update(**final, updated_at=datetime.now(timezone.utc))


def cancel(db, job: Job) -> Job:
    if job.status not in JobStatus.ACTIVE:
        return job
    job.cancel_requested = 1
    if job.status == JobStatus.PENDING:  # ainda na fila: remove direto
        if not get_settings().queue_eager:
            try:
                from rq.job import Job as RQJob

                RQJob.fetch(job.id, connection=_queue().connection).delete()
            except Exception:
                pass
        job.status, job.stage = JobStatus.CANCELLED, "Cancelado"
    db.commit()
    return job


def recover_interrupted() -> int:
    """Chamado na subida do worker (MVP: um único worker). Jobs que ficaram `running`/`pending`
    sem estarem na fila foram interrompidos (queda, reinício): reenfileira ou encerra."""
    from rq.job import Job as RQJob

    q = _queue()
    queued = set(q.job_ids) | set(q.scheduled_job_registry.get_job_ids())
    n = 0
    with SessionLocal() as db:
        for job in db.query(Job).filter(Job.status.in_(JobStatus.ACTIVE)).all():
            if job.id in queued:
                continue
            try:
                RQJob.fetch(job.id, connection=q.connection).delete()
            except Exception:
                pass
            if job.cancel_requested:
                job.status, job.stage = JobStatus.CANCELLED, "Cancelado"
            elif job.attempts >= get_settings().job_max_attempts:
                job.status, job.stage = JobStatus.FAILED, "Falhou"
                job.error_message = "Processamento interrompido e limite de tentativas atingido."
            else:
                job.status, job.stage = JobStatus.PENDING, "Retomando após interrupção"
                db.commit()
                enqueue(job.id)
            n += 1
        db.commit()
    return n
