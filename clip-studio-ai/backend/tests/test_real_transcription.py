"""Transcrição REAL com Faster-Whisper sobre o vídeo de teste com fala.

Baixa o modelo na primeira execução, por isso é opcional:
    CLIPSTUDIO_REAL_WHISPER=1 WHISPER_MODEL=tiny pytest tests/test_real_transcription.py
"""
import os

import pytest

from tests.make_test_video import has_flite
from tests.test_api import upload

pytestmark = pytest.mark.skipif(
    os.environ.get("CLIPSTUDIO_REAL_WHISPER") != "1" or not has_flite(),
    reason="defina CLIPSTUDIO_REAL_WHISPER=1 (requer modelo Whisper e FFmpeg com flite)")


def test_real_transcription_pipeline(auth, sample_video):
    pid = auth.post("/api/projects", json={"name": "Whisper real"}).json()["id"]
    vid = upload(auth, pid, sample_video).json()["id"]
    job = auth.get(f"/api/jobs/{auth.post(f'/api/videos/{vid}/transcribe', json={}).json()['id']}").json()
    assert job["status"] == "completed", (job["error_message"], job["log"][-1500:])
    t = auth.get(f"/api/videos/{vid}/transcript").json()
    text = " ".join(s["text"] for s in t["segments"]).lower()
    assert t["language"] == "en" and "passport" in text and "insurance" in text
    for s in t["segments"]:  # texto associado ao tempo do vídeo
        assert 0 <= s["start"] < s["end"] <= 30.5 and s["words"]
    srt = auth.get(f"/api/videos/{vid}/transcript", params={"format": "srt"}).text
    assert srt.startswith("1\n00:00:0")

    # corte manual sobre a transcrição real -> render com legenda
    clip = auth.post(f"/api/videos/{vid}/clips", json={"title": "Passaporte", "start_time": 4, "end_time": 14}).json()
    assert clip["transcript"]
    auth.patch(f"/api/clips/{clip['id']}", json={"status": "approved"})
    job = auth.get(f"/api/jobs/{auth.post(f'/api/clips/{clip['id']}/render', json={}).json()['id']}").json()
    assert job["status"] == "completed", (job["error_message"], job["log"][-1500:])
    assert "-->" in auth.get(f"/api/clips/{clip['id']}/srt").text
