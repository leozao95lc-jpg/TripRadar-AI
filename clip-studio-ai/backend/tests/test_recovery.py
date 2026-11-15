"""Recuperação de erros: falha inesperada, cancelamento e retomada de jobs interrompidos."""
import pytest

from app import jobs, tasks, transcription
from app.db import SessionLocal
from app.models import Job, JobStatus
from tests.conftest import fake_transcript
from tests.test_api import upload


@pytest.fixture()
def video(auth, sample_video):
    pid = auth.post("/api/projects", json={"name": "P"}).json()["id"]
    return pid, upload(auth, pid, sample_video).json()["id"]


def test_unexpected_failure_is_reported_and_retry_works(auth, video, monkeypatch):
    _, vid = video

    def boom(*a, **k):
        raise RuntimeError("disco cheio simulado")

    monkeypatch.setattr(transcription, "transcribe", boom)
    job = auth.get(f"/api/jobs/{auth.post(f'/api/videos/{vid}/transcribe', json={}).json()['id']}").json()
    assert job["status"] == "failed" and "RuntimeError" in job["error_message"]
    assert "disco cheio simulado" in job["log"]  # detalhe técnico fica no log, não na mensagem ao usuário
    assert auth.get(f"/api/videos/{vid}").json()["status"] == "failed"

    monkeypatch.setattr(transcription, "transcribe", lambda audio, duration, *a, **k: fake_transcript(duration))
    job = auth.get(f"/api/jobs/{auth.post(f'/api/videos/{vid}/transcribe', json={}).json()['id']}").json()
    assert job["status"] == "completed"
    assert auth.get(f"/api/videos/{vid}").json()["status"] == "transcribed"


def test_cancel_pending_job(auth, video):
    pid, vid = video
    with SessionLocal() as db:
        job_id = jobs.create_job(db, pid, "transcribe", video_id=vid).id
    assert auth.post(f"/api/videos/{vid}/transcribe", json={}).status_code == 409  # um job por vídeo
    assert auth.post(f"/api/jobs/{job_id}/cancel").json()["status"] == "cancelled"
    jobs.run_job(job_id)  # se o worker ainda pegar o job cancelado, nada é executado
    assert auth.get(f"/api/jobs/{job_id}").json()["status"] == "cancelled"


def test_recover_interrupted_jobs(auth, video, monkeypatch):
    pid, vid = video
    with SessionLocal() as db:
        ids = {}
        for name, attempts, cancel in (("retry", 1, 0), ("exhausted", 2, 0), ("cancelled", 1, 1)):
            j = Job(project_id=pid, video_id=vid, job_type="transcribe", status=JobStatus.RUNNING,
                    attempts=attempts, cancel_requested=cancel)
            db.add(j)
            db.flush()
            ids[name] = j.id
        db.commit()

    class EmptyQueue:  # simula o Redis após uma queda: nada na fila
        job_ids: list = []
        connection = None

        class scheduled_job_registry:
            @staticmethod
            def get_job_ids():
                return []

    requeued = []
    monkeypatch.setattr(jobs, "_queue", lambda: EmptyQueue)
    monkeypatch.setattr(jobs, "enqueue", requeued.append)
    assert jobs.recover_interrupted() == 3
    assert requeued == [ids["retry"]]
    got = {k: auth.get(f"/api/jobs/{v}").json() for k, v in ids.items()}
    assert got["retry"]["status"] == "pending" and "Retomando" in got["retry"]["stage"]
    assert got["exhausted"]["status"] == "failed" and "interrompido" in got["exhausted"]["error_message"]
    assert got["cancelled"]["status"] == "cancelled"


def test_status_after_stop_reflects_existing_data(auth, video):
    _, vid = video
    assert tasks.status_after_stop(vid, "pending") == "pending"
    assert tasks.status_after_stop(vid, "pending", failed=True) == "failed"
