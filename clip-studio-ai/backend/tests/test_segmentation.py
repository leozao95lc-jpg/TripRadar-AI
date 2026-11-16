"""Segmentação em frases, testada contra a saída REAL do Faster-Whisper (modelo small) em
português e espanhol — tests/data/whisper_real_pt_es.json."""
import json
from pathlib import Path

import pytest

from app import editorial, subtitles
from app.editorial import AnalysisConfig, LLMCut, LLMResponse
from app.transcription import resegment

DATA = json.loads((Path(__file__).parent / "data" / "whisper_real_pt_es.json").read_text(encoding="utf-8"))


def words_of(lang):
    return [w for s in DATA[lang]["whisper_segments"] for w in s["words"]]


def test_whisper_blocks_do_not_follow_sentences():
    """O motivo de existir a ressegmentação: os blocos do Whisper cortam frases ao meio."""
    raw = DATA["pt"]["whisper_segments"]
    assert sum(s["text"].strip().endswith(".") for s in raw) == 1 and len(raw) == 12


def test_portuguese_is_regrouped_into_sentences():
    words = words_of("pt")
    units = resegment(words)
    assert len(units) == 15 and all(u["text"].endswith(".") for u in units)
    assert units[0]["text"] == "Hoje a gente vai falar de uma viagem que deu muito errado."
    assert units[1]["text"].startswith("Eu cheguei no aeroporto") and units[1]["text"].endswith("tinha vencido.")
    assert sum(len(u["words"]) for u in units) == len(words)  # nenhuma palavra se perde
    assert [u["id"] for u in units] == list(range(15))
    for a, b in zip(units, units[1:]):
        assert a["start"] < a["end"] <= b["start"]


def test_spanish_run_on_sentences_are_split_at_pauses():
    """Em espanhol o modelo small trocou pontos por vírgulas (frase de 20 s). Nenhuma unidade
    passa do limite, e a divisão acontece depois de vírgula."""
    units = resegment(words_of("es"))
    assert all(u["end"] - u["start"] <= 15 for u in units)
    assert units[0]["text"].endswith(",") and units[1]["text"].endswith("antes de viajar.")
    assert sum(len(u["words"]) for u in units) == len(words_of("es"))


def test_cut_boundaries_fall_on_sentence_boundaries():
    units = resegment(words_of("pt"))
    cut = LLMCut(start_segment=1, end_segment=3, title="Passaporte vencido", hook="h", rationale="r", cta="c",
                 editorial_score=90, category="historia")
    cfg = AnalysisConfig(preferred_min_seconds=10, preferred_max_seconds=30, max_seconds=60)
    (clip,) = editorial.postprocess(LLMResponse(cuts=[cut]), units, 56.9, cfg)
    assert clip.transcript.startswith("Eu cheguei no aeroporto") and clip.transcript.endswith("antes de viajar.")
    assert units[0]["end"] <= clip.start_time < units[1]["start"]  # não invade a frase anterior
    assert units[3]["end"] < clip.end_time <= units[4]["start"]  # nem a seguinte
    assert clip.warnings == []

    # em espanhol a unidade 5 termina em vírgula: o corte é estendido até o fim real da frase
    es = resegment(words_of("es"))
    cut = LLMCut(start_segment=4, end_segment=5, title="t", hook="h", rationale="r", cta="c", editorial_score=80,
                 category="dica")
    (clip,) = editorial.postprocess(LLMResponse(cuts=[cut]), es, 62.0, cfg)
    assert clip.transcript.endswith("con la gente del lugar.")


def test_srt_cues_are_caption_sized():
    units = resegment(words_of("pt"))
    srt = subtitles.to_srt(units)
    blocks = [b.split("\n") for b in srt.strip().split("\n\n")]
    assert len(blocks) >= 12
    for b in blocks:
        assert len(b) <= 4 and all(len(line) <= 60 for line in b[2:])  # no máximo 2 linhas curtas
    assert blocks[0][1].startswith("00:00:00,000 --> 00:00:02,6")
    clip_srt = subtitles.to_srt(units, 17.0, 25.0)  # tempos relativos ao início do corte
    assert clip_srt.startswith("1\n00:00:00,240 --> ") and "seguro viagem" in clip_srt


@pytest.mark.parametrize("tokens,expected", [
    (["O", "Sr.", "Silva", "chegou.", "Depois", "saiu."], ["O Sr. Silva chegou.", "Depois saiu."]),
    (["Eu", "acho", "que...", "não", "sei.", "Talvez."], ["Eu acho que... não sei.", "Talvez."]),
    (["¿Qué", "pasó?", "¡Nada!", "Seguimos."], ["¿Qué pasó?", "¡Nada!", "Seguimos."]),
    (["sem", "pontuação", "nenhuma"], ["sem pontuação nenhuma"]),
])
def test_sentence_rules(tokens, expected):
    words = [{"word": t, "start": i * 0.4, "end": i * 0.4 + 0.35} for i, t in enumerate(tokens)]
    assert [u["text"] for u in resegment(words)] == expected


def test_long_silence_starts_new_unit_and_empty_input():
    words = [{"word": "antes", "start": 0, "end": 0.4}, {"word": "depois", "start": 5.0, "end": 5.4}]
    assert [u["text"] for u in resegment(words)] == ["antes", "depois"]
    assert resegment([]) == []
