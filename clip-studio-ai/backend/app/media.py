"""Wrappers de FFprobe/FFmpeg. Tudo opera arquivo->arquivo; nada é carregado em memória."""
import json
import subprocess
import time
from functools import lru_cache
from pathlib import Path
from typing import Callable

from .config import get_settings
from .errors import AppError


class MediaError(AppError):
    pass


class Cancelled(Exception):
    pass


HDR_TRANSFERS = {"smpte2084", "arib-std-b67"}  # PQ (HDR10/Dolby Vision) e HLG (iPhone, câmeras)


@lru_cache
def available_filters() -> frozenset[str]:
    r = subprocess.run([get_settings().ffmpeg_bin, "-hide_banner", "-filters"], capture_output=True, text=True,
                       timeout=30)
    return frozenset(parts[1] for parts in (line.split() for line in r.stdout.splitlines()) if len(parts) > 2)


def tonemap_chain(transfer: str | None) -> str | None:
    """Filtros que convertem HDR (BT.2020 HLG/PQ) em SDR BT.709. Sem isso, o H.264 8 bits sai
    com cores lavadas. Devolve None para SDR ou quando o FFmpeg não tem zscale/tonemap."""
    if transfer not in HDR_TRANSFERS or not {"zscale", "tonemap"} <= available_filters():
        return None
    return (f"zscale=tin={transfer}:pin=2020:min=2020_ncl:t=linear:npl=100,format=gbrpf32le,"
            "zscale=p=709,tonemap=tonemap=hable:desat=0,zscale=t=709:m=709:r=limited,format=yuv420p")


def probe(path: Path) -> dict:
    s = get_settings()
    cmd = [s.ffprobe_bin, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise MediaError("Arquivo não reconhecido como vídeo válido.")
    data = json.loads(r.stdout or "{}")
    v = next((x for x in data.get("streams", []) if x.get("codec_type") == "video"), None)
    if not v:
        raise MediaError("O arquivo não contém faixa de vídeo.")
    a = next((x for x in data.get("streams", []) if x.get("codec_type") == "audio"), None)
    duration = float(data.get("format", {}).get("duration") or v.get("duration") or 0)
    if duration <= 0:
        raise MediaError("Não foi possível determinar a duração do vídeo.")
    w, h = int(v["width"]), int(v["height"])
    rot = 0
    for sd in v.get("side_data_list", []) or []:
        rot = int(sd.get("rotation", 0) or 0) or rot
    if abs(rot) in (90, 270):
        w, h = h, w
    num, _, den = (v.get("avg_frame_rate") or "0/1").partition("/")
    fps = float(num) / float(den or 1) if float(den or 1) else 0.0
    transfer = v.get("color_transfer")
    return {
        "duration": duration, "width": w, "height": h, "fps": round(fps, 3),
        "has_audio": a is not None, "video_codec": v.get("codec_name"), "audio_codec": a and a.get("codec_name"),
        "pix_fmt": v.get("pix_fmt"), "hdr_transfer": transfer if transfer in HDR_TRANSFERS else None,
    }


def run_ffmpeg(
    args: list[str],
    total_seconds: float,
    on_progress: Callable[[float], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> None:
    """Executa ffmpeg lendo `-progress` para reportar avanço e permitir cancelamento."""
    s = get_settings()
    cmd = [s.ffmpeg_bin, "-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-progress", "pipe:1", *args]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    last = 0.0
    try:
        for line in proc.stdout:  # type: ignore[union-attr]
            if line.startswith("out_time_us=") or line.startswith("out_time_ms="):
                val = line.split("=", 1)[1].strip()
                if val.lstrip("-").isdigit() and total_seconds > 0 and time.time() - last > 0.5:
                    last = time.time()
                    if should_cancel and should_cancel():
                        raise Cancelled()
                    if on_progress:
                        on_progress(max(0.0, min(1.0, int(val) / 1e6 / total_seconds)))
        err = proc.stderr.read()  # type: ignore[union-attr]
        if proc.wait() != 0:
            raise MediaError(f"FFmpeg falhou: {err.strip()[-800:]}")
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()


def extract_audio(src: Path, dst: Path, duration: float, **kw) -> None:
    """Áudio mono 16 kHz para o Whisper (único derivado necessário à transcrição)."""
    run_ffmpeg(["-i", str(src), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(dst)], duration, **kw)


def make_proxy(src: Path, dst: Path, duration: float, hdr_transfer: str | None = None, **kw) -> None:
    """Proxy H.264 leve para o player de revisão (originais MOV/HEVC nem sempre tocam no navegador)."""
    tm = tonemap_chain(hdr_transfer)
    run_ffmpeg(
        ["-i", str(src), "-vf", "scale='min(1280,iw)':-2" + (f",{tm}" if tm else ""), "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-ac", "2", "-movflags", "+faststart", str(dst)],
        duration, **kw,
    )

