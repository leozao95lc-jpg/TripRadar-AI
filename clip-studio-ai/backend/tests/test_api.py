import pytest

from app import editorial, media, storage, transcription
from app.editorial import LLMCut, LLMResponse
from tests.conftest import fake_transcript


def upload(c, pid, path, name="Episódio 1.mp4"):
    with open(path, "rb") as f:
        return c.post(f"/api/projects/{pid}/videos", params={"filename": name}, content=f,
                      headers={"content-type": "application/octet-stream"})


@pytest.fixture()
def mocks(monkeypatch):
    monkeypatch.setattr(transcription, "transcribe", lambda audio, duration, *a, **k: fake_transcript(duration))
    cuts = [LLMCut(start_segment=0, end_segment=4, title="O passaporte vencido", hook="Descobri no balcão",
                   rationale="História completa com virada e dica.", cta="Salve para a próxima viagem",
                   editorial_score=88, category="historia"),
            LLMCut(start_segment=5, end_segment=7, title="Seguro viagem", hook="Dinheiro jogado fora?",
                   rationale="Opinião clara.", cta="Comente", editorial_score=71, category="dica")]
    monkeypatch.setattr(editorial, "call_claude", lambda prompt: LLMResponse(cuts=cuts))


def test_auth_required(client):
    for url in ("/api/projects", "/api/dashboard", "/api/jobs", "/api/exports", "/api/videos/x/stream",
                "/api/exports/x/download"):
        assert client.get(url).status_code == 401
    assert client.post("/api/auth/login", json={"password": "errada"}).status_code == 401
    assert client.get("/api/health").status_code == 200


def test_upload_validation(auth, tmp_path, sample_video):
    pid = auth.post("/api/projects", json={"name": "P"}).json()["id"]
    fake = tmp_path / "fake.mp4"
    fake.write_bytes(b"isto nao e um video" * 10)
    assert upload(auth, pid, fake).status_code == 415
    assert upload(auth, pid, sample_video, "malware.exe").status_code == 415
    assert upload(auth, "f" * 32, sample_video).status_code == 404
    assert not list(storage.project_dir(pid, "videos").iterdir())  # nada parcial fica para trás


def test_full_pipeline(auth, sample_video, mocks):
    pid = auth.post("/api/projects", json={"name": "Viagens", "description": "Episódios"}).json()["id"]
    r = upload(auth, pid, sample_video, "../../Episódio 1.mp4")
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["resolution"] == "1280x720" and 29 < v["duration"] < 31 and v["status"] == "pending"
    assert v["filename"] == "Episódio 1.mp4"
    vid = v["id"]

    # player com Range
    r = auth.get(f"/api/videos/{vid}/stream", headers={"Range": "bytes=0-99"})
    assert r.status_code == 206 and len(r.content) == 100

    job = auth.post(f"/api/videos/{vid}/process", json={}).json()
    job = auth.get(f"/api/jobs/{job['id']}").json()
    assert job["status"] == "completed", job
    assert "apenas a transcrição" in job["log"]
    assert auth.get(f"/api/videos/{vid}").json()["status"] == "awaiting_review"
    assert auth.get(f"/api/videos/{vid}/transcript").json()["language"] == "pt"
    assert "-->" in auth.get(f"/api/videos/{vid}/transcript", params={"format": "srt"}).text

    clips = auth.get(f"/api/videos/{vid}/clips").json()
    assert [c["editorial_score"] for c in clips] == [88, 71]
    clip = clips[0]
    assert clip["status"] == "suggested" and clip["transcript"].startswith("Hoje a gente")

    # não renderiza sem aprovação
    assert auth.post(f"/api/clips/{clip['id']}/render", json={}).status_code == 409
    # timestamps respeitam a duração do original
    assert auth.patch(f"/api/clips/{clip['id']}", json={"end_time": 999}).status_code == 422
    assert auth.patch(f"/api/clips/{clip['id']}", json={"start_time": 10, "end_time": 10.2}).status_code == 422
    r = auth.patch(f"/api/clips/{clip['id']}", json={"title": "Novo título", "start_time": 4.0, "end_time": 16.4,
                                                     "status": "approved"}).json()
    assert r["title"] == "Novo título" and r["duration"] == 12.4 and r["status"] == "approved"
    assert r["transcript"].startswith("Eu cheguei")

    job = auth.post(f"/api/clips/{clip['id']}/render",
                    json={"preset": "reels", "fade": True, "subtitle_preset": "dinamico"}).json()
    job = auth.get(f"/api/jobs/{job['id']}").json()
    assert job["status"] == "completed", job
    exp = auth.get(f"/api/videos/{vid}/clips").json()[0]["exports"][0]
    r = auth.get(f"/api/exports/{exp['id']}/download")
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    out = storage.resolve("tmp") / "check.mp4"
    out.write_bytes(r.content)
    info = media.probe(out)
    assert (info["width"], info["height"]) == (1080, 1920)
    assert info["video_codec"] == "h264" and info["audio_codec"] == "aac" and abs(info["duration"] - 12.4) < 0.3
    assert auth.get(f"/api/videos/{vid}").json()["status"] == "completed"

    # nova análise preserva o corte renderizado e não o duplica
    auth.post(f"/api/videos/{vid}/analyze", json={})
    clips = auth.get(f"/api/videos/{vid}/clips").json()
    assert sorted(c["status"] for c in clips) == ["rendered", "suggested"]

    d = auth.get("/api/dashboard").json()
    assert d["totals"] == {"projects": 1, "videos": 1, "clips": 2, "exports": 1, "active_jobs": 0}
    assert not list(storage.resolve("tmp").glob("job_*"))  # temporários limpos

    pdir = storage.project_dir(pid)
    assert auth.delete(f"/api/projects/{pid}").status_code == 204
    assert not pdir.exists() and auth.get("/api/projects").json() == []
    assert auth.get(f"/api/exports/{exp['id']}/download").status_code == 404


def test_analysis_failure_keeps_transcript(auth, sample_video, monkeypatch):
    monkeypatch.setattr(transcription, "transcribe", lambda audio, duration, *a, **k: fake_transcript(duration))
    pid = auth.post("/api/projects", json={"name": "P"}).json()["id"]
    vid = upload(auth, pid, sample_video).json()["id"]
    job = auth.post(f"/api/videos/{vid}/process", json={}).json()
    job = auth.get(f"/api/jobs/{job['id']}").json()
    assert job["status"] == "failed" and "ANTHROPIC_API_KEY" in job["error_message"]
    assert auth.get(f"/api/videos/{vid}").json()["status"] == "transcribed"


def test_settings(auth):
    r = auth.put("/api/settings/brand", json={"channel_name": "De Mala y Cuia", "accent_color": "#E8622C"})
    assert r.status_code == 200 and r.json()["has_logo"] is False
    assert auth.post("/api/settings/brand/logo", content=b"GIF89a").status_code == 415
    s = auth.get("/api/settings/subtitles").json()
    assert set(s["builtin"]) == {"clean", "dinamico", "de_mala_y_cuia"} and set(s["render_presets"]) == {
        "reels", "shorts", "tiktok"}
    style = {**s["builtin"]["clean"], "size": 90}
    assert auth.put("/api/settings/subtitles/clean", json=style).status_code == 422
    assert auth.put("/api/settings/subtitles/meu_estilo", json=style).json()["custom"]["meu_estilo"]["size"] == 90
    assert auth.put("/api/settings/subtitles/x", json={**style, "color": "red"}).status_code == 422
