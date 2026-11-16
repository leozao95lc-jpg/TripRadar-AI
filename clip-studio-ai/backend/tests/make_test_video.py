"""Gera um vídeo de teste curto (16:9, 30 s) para validar o pipeline completo.

Uso:  python -m tests.make_test_video saida.mp4

Se o FFmpeg tiver o filtro `flite`, o áudio é FALA sintetizada (em inglês — é o que o flite
oferece), o que permite testar a transcrição de verdade. Sem `flite`, o áudio é um tom e o
vídeo serve para testar upload, player e renderização.
"""
import subprocess
import sys
from pathlib import Path

SPEECH = ("Welcome to the travel show. Today we will talk about a trip that went completely wrong. "
          "I arrived at the airport and discovered that my passport had expired. "
          "So here is the lesson. Always check your documents one month before you travel. "
          "Another important thing is travel insurance. Many people think it is a waste of money. "
          "Until they need a hospital in a foreign country.")


def has_flite() -> bool:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True)
    return " flite " in r.stdout


def make(path: Path, seconds: int = 30) -> bool:
    """Devolve True se o áudio contém fala."""
    speech = has_flite()
    text_file = path.with_suffix(".txt")
    text_file.write_text(SPEECH, encoding="utf-8")
    audio = f"flite=textfile={text_file}:voice=slt" if speech else f"sine=frequency=440:duration={seconds}"
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"testsrc2=s=1280x720:r=30:d={seconds}",
             "-f", "lavfi", "-i", audio, "-af", "apad", "-t", str(seconds), "-c:v", "libx264", "-preset", "ultrafast",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "44100", str(path)], check=True)
    finally:
        text_file.unlink(missing_ok=True)
    return speech


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "video_teste.mp4")
    print(f"{out} gerado ({'com fala' if make(out) else 'sem fala: ffmpeg sem flite'})")
