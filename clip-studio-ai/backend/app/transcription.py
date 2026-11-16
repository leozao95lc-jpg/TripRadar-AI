"""Transcrição local com Faster-Whisper. Nenhum áudio sai da máquina."""
import re
from pathlib import Path
from typing import Callable

from .config import get_settings
from .errors import AppError

_model = None

SENTENCE_END = re.compile(r"[.!?…]+[\"'”’»)\]]*$")
ABBREVIATIONS = {"sr.", "sra.", "srta.", "dr.", "dra.", "prof.", "profa.", "av.", "ud.", "uds.", "vs."}
MAX_UNIT_SECONDS = 15.0  # frases mais longas que isso são divididas na pausa mais forte
MIN_PIECE_SECONDS = 2.5


def _ends_sentence(word: str, next_word: str | None) -> bool:
    w = word.strip()
    if not SENTENCE_END.search(w) or w.lower() in ABBREVIATIONS or re.fullmatch(r"[A-Za-zÀ-ÿ]\.", w):
        return False
    if next_word:  # "eu acho que... não sei": reticências seguidas de minúscula não encerram a frase
        first = next((c for c in next_word.strip() if c.isalpha()), "")
        if first and first.islower():
            return False
    return True


def _split_long(words: list[dict]) -> list[list[dict]]:
    """Frase longa demais (fala sem pontuação ou o modelo trocou ponto por vírgula): divide na
    pausa mais forte, de preferência depois de vírgula, até cada parte caber no limite."""
    if words[-1]["end"] - words[0]["start"] <= MAX_UNIT_SECONDS:
        return [words]
    best = None
    for i in range(len(words) - 1):
        left = words[i]["end"] - words[0]["start"]
        right = words[-1]["end"] - words[i + 1]["start"]
        if left < MIN_PIECE_SECONDS or right < MIN_PIECE_SECONDS:
            continue
        gap = words[i + 1]["start"] - words[i]["end"]
        clause = words[i]["word"].strip()[-1:] in ",;:"
        if gap < 0.25 and not clause:
            continue  # sem pausa nem pontuação: não há evidência de fronteira
        score = gap + (0.3 if clause else 0.0) - 0.2 * abs(left - right) / (left + right)
        if best is None or score > best[0]:
            best = (score, i)
    if best is None:
        return [words]
    i = best[1]
    return _split_long(words[: i + 1]) + _split_long(words[i + 1:])


def resegment(words: list[dict]) -> list[dict]:
    """Reagrupa as palavras (com timestamps) em FRASES.

    O Whisper devolve blocos de ~5 s que quase sempre começam e terminam no meio de uma frase.
    Como os cortes são definidos por índice de segmento, as unidades precisam ser frases — assim
    todo corte começa e termina em fronteira de frase por construção."""
    sentences: list[list[dict]] = []
    cur: list[dict] = []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        long_pause = nxt is not None and nxt["start"] - w["end"] >= 2.0
        if nxt is None or long_pause or _ends_sentence(w["word"], nxt["word"]):
            sentences.append(cur)
            cur = []
    units = [piece for s in sentences for piece in _split_long(s)]
    return [{"id": i, "start": u[0]["start"], "end": u[-1]["end"], "speaker": None,
             "text": " ".join(w["word"].strip() for w in u), "words": u} for i, u in enumerate(units)]


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


def _load_wav(path: Path):
    """Lê o WAV 16 kHz mono gerado pelo FFmpeg. Evita o decodificador PyAV do faster-whisper,
    que é incompatível com versões recentes do PyAV (erro `metadata_errors`)."""
    import wave

    import numpy as np

    with wave.open(str(path), "rb") as w:
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (16000, 1, 2):
            raise AppError("Áudio extraído em formato inesperado.")
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return pcm.astype(np.float32) / 32768.0


def transcribe(audio: Path, duration: float, language: str | None = None,
               on_progress: Callable[[float], None] | None = None,
               should_cancel: Callable[[], bool] | None = None) -> dict:
    """Devolve {language, language_probability, duration, segments[{id,start,end,text,speaker,words[]}]}.

    `speaker` fica None: o Whisper não faz diarização e não atribuímos falantes sem evidência.
    """
    from .media import Cancelled

    segs, info = _get_model().transcribe(
        _load_wav(audio), language=language, word_timestamps=True, vad_filter=True, beam_size=5,
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
    words = [w for seg in out for w in seg["words"] if w["word"]]
    if words:  # sem timestamps por palavra (não deveria ocorrer) ficam os blocos originais
        out = resegment(words)
    return {
        "language": info.language, "language_probability": round(float(info.language_probability), 4),
        "duration": duration, "model": get_settings().whisper_model, "diarization": False,
        "segmentation": "sentences" if words else "whisper", "segments": out,
    }
