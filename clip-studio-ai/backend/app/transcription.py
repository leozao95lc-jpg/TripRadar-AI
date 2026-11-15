"""Transcrição local com Faster-Whisper. Nenhum áudio sai da máquina."""
from pathlib import Path
from typing import Callable

from .config import get_settings
from .errors import AppError

_model = None


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel  # import tardio: carregamento pesado só no worker

        s = get_settings()
        try:
            _model = WhisperModel(s.whisper_model, device=s.whisper_device, compute_type=s.whisper_compute_type)
        except Exception as e:  # primeira execução baixa o modelo do Hugging Face
            raise AppError(f"Não foi possível carregar o modelo Whisper '{s.whisper_model}'. Na primeira execução "
                           f"ele é baixado da internet; verifique a conexão. ({type(e).__name__})") from e
    return _model


def transcribe(audio: Path, duration: float, language: str | None = None,
               on_progress: Callable[[float], None] | None = None,
               should_cancel: Callable[[], bool] | None = None) -> dict:
    """Devolve {language, language_probability, duration, segments[{id,start,end,text,speaker,words[]}]}.

    `speaker` fica None: o Whisper não faz diarização e não atribuímos falantes sem evidência.
    """
    from .media import Cancelled

    segs, info = _get_model().transcribe(
        str(audio), language=language, word_timestamps=True, vad_filter=True, beam_size=5,
    )
    out = []
    for i, s in enumerate(segs):  # gerador: a transcrição acontece conforme iteramos
        if should_cancel and should_cancel():
            raise Cancelled()
        text = s.text.strip()
        if not text:
            continue
        out.append({
            "id": len(out), "start": round(s.start, 3), "end": round(s.end, 3), "text": text, "speaker": None,
            "words": [{"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)}
                      for w in (s.words or [])],
        })
        if on_progress and duration > 0:
            on_progress(min(1.0, s.end / duration))
    return {
        "language": info.language, "language_probability": round(float(info.language_probability), 4),
        "duration": duration, "model": get_settings().whisper_model, "diarization": False, "segments": out,
    }
