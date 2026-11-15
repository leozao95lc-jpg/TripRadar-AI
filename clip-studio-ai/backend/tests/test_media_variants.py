"""Variações de mídia: HDR, vídeo sem áudio e logo. Tudo com FFmpeg real."""
import subprocess

import pytest

from app import media, storage
from tests.test_api import upload


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def render_and_download(c, vid, opts, start=1, end=4):
    clip = c.post(f"/api/videos/{vid}/clips", json={"title": "Corte", "start_time": start, "end_time": end}).json()
    assert c.patch(f"/api/clips/{clip['id']}", json={"status": "approved"}).status_code == 200
    job = c.get(f"/api/jobs/{c.post(f'/api/clips/{clip['id']}/render', json=opts).json()['id']}").json()
    assert job["status"] == "completed", (job["error_message"], job["log"][-800:])
    exp = next(x for x in c.get(f"/api/videos/{vid}/clips").json() if x["id"] == clip["id"])["exports"][0]
    out = storage.resolve("temp") / f"{clip['id']}.mp4"
    out.write_bytes(c.get(f"/api/exports/{exp['id']}/download").content)
    return out, job


def pixel(path, x, y):
    """Cor média (r, g, b) de um quadrado 20x20 do frame em t=1s."""
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", "1", "-i", str(path), "-frames:v", "1", "-vf",
                        f"crop=20:20:{x}:{y},scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                       capture_output=True, check=True)
    return tuple(r.stdout[:3])


@pytest.fixture()
def project(auth):
    return auth.post("/api/projects", json={"name": "Mídia"}).json()["id"]


@pytest.mark.skipif(not {"zscale", "tonemap"} <= media.available_filters(), reason="FFmpeg sem zscale/tonemap")
def test_hdr_video_is_tonemapped_to_sdr(auth, project, tmp_path):
    src = tmp_path / "hlg.mov"  # HLG 10 bits BT.2020, como gravam iPhones e câmeras em HDR
    try:
        ffmpeg("-f", "lavfi", "-i", "testsrc2=s=1920x1080:r=30:d=5", "-f", "lavfi", "-i", "sine=d=5", "-vf",
               "zscale=tin=709:pin=709:min=709:t=arib-std-b67:p=2020:m=2020_ncl,format=yuv420p10le",
               "-c:v", "libx265", "-preset", "ultrafast", "-tag:v", "hvc1", "-x265-params",
               "colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:log-level=error",
               "-c:a", "aac", "-shortest", str(src))
    except subprocess.CalledProcessError:
        pytest.skip("FFmpeg sem libx265 para gerar o vídeo HDR de teste")
    v = upload(auth, project, src, "viagem hdr.mov").json()
    assert v["hdr"] is True and v["resolution"] == "1920x1080"

    out, job = render_and_download(auth, v["id"], {"subtitles": False})
    info = media.probe(out)
    assert info["video_codec"] == "h264" and info["pix_fmt"] == "yuv420p" and info["hdr_transfer"] is None
    assert (info["width"], info["height"]) == (1080, 1920)
    assert "lavadas" not in job["log"]

    proxy = tmp_path / "proxy.mp4"  # o player de revisão também recebe SDR
    media.make_proxy(src, proxy, 5, "arib-std-b67")
    p = media.probe(proxy)
    assert p["video_codec"] == "h264" and p["pix_fmt"] == "yuv420p" and p["hdr_transfer"] is None


def test_video_without_audio(auth, project, tmp_path):
    src = tmp_path / "mudo.mp4"
    ffmpeg("-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30:d=6", "-c:v", "libx264", "-preset", "ultrafast",
           "-pix_fmt", "yuv420p", "-an", str(src))
    v = upload(auth, project, src, "mudo.mp4").json()
    assert v["has_audio"] is False and v["hdr"] is False

    job = auth.get(f"/api/jobs/{auth.post(f'/api/videos/{v['id']}/transcribe', json={}).json()['id']}").json()
    assert job["status"] == "failed" and "faixa de áudio" in job["error_message"]

    out, _ = render_and_download(auth, v["id"], {})  # corte manual segue possível, sem legenda
    assert media.probe(out)["audio_codec"] == "aac"  # faixa silenciosa: as redes exigem áudio
    assert auth.get(f"/api/videos/{v['id']}").json()["status"] == "completed"


def test_logo_is_burned_into_video(auth, project, sample_video, tmp_path):
    logo = tmp_path / "logo.png"
    ffmpeg("-f", "lavfi", "-i", "color=c=red:s=400x200", "-frames:v", "1", str(logo))
    assert auth.post("/api/settings/brand/logo", content=logo.read_bytes()).status_code == 200
    assert auth.get("/api/settings/brand").json()["has_logo"] is True
    assert auth.get("/api/settings/brand/logo").content.startswith(b"\x89PNG")

    vid = upload(auth, project, sample_video).json()["id"]
    plain, _ = render_and_download(auth, vid, {"subtitles": False, "logo": False})
    with_logo, _ = render_and_download(auth, vid, {"subtitles": False, "logo": True}, start=1, end=4.5)
    r, g, b = pixel(with_logo, 900, 180)  # dentro da área do logo (canto superior direito)
    assert r > 180 and g < 70 and b < 70
    assert pixel(plain, 900, 180) != (r, g, b)
    assert pixel(with_logo, 100, 180) == pytest.approx(pixel(plain, 100, 180), abs=12)  # fora do logo: igual

    assert auth.delete("/api/settings/brand/logo").status_code == 204
    assert auth.get("/api/settings/brand").json()["has_logo"] is False


def test_login_rate_limit_and_utc_dates(client):
    for _ in range(8):
        assert client.post("/api/auth/login", json={"password": "errada"}).status_code == 401
    assert client.post("/api/auth/login", json={"password": "senha-teste"}).status_code == 429
    from app import security

    security._failures.clear()
    assert client.post("/api/auth/login", json={"password": "senha-teste"}).status_code == 200
    created = client.post("/api/projects", json={"name": "Fuso"}).json()["created_at"]
    assert created.endswith("Z") or created.endswith("+00:00")
