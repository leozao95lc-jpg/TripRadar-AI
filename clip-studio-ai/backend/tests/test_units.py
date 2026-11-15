import pytest

from app import editorial, framing, storage, subtitles
from app.editorial import AnalysisConfig, LLMCut, LLMResponse
from tests.conftest import fake_transcript


def cut(a, b, score=80, **kw):
    return LLMCut(start_segment=a, end_segment=b, title="T", hook="H", rationale="R", cta="C",
                  editorial_score=score, category="historia", **kw)


CFG = AnalysisConfig(preferred_min_seconds=5, preferred_max_seconds=20, max_seconds=25)
SEGS = fake_transcript()["segments"]


def test_text_comes_from_transcript_not_from_llm():
    out = editorial.postprocess(LLMResponse(cuts=[cut(0, 1)]), SEGS, 30, CFG)
    assert out[0].transcript == f"{SEGS[0]['text']} {SEGS[1]['text']}"
    assert 0 <= out[0].start_time < out[0].end_time <= 30


def test_snaps_incomplete_sentence_boundaries():
    # segmento 2 termina sem pontuação e o 3 começa no meio da frase
    out = editorial.postprocess(LLMResponse(cuts=[cut(1, 2)]), SEGS, 30, CFG)
    assert out[0].transcript.endswith("rindo.")
    out = editorial.postprocess(LLMResponse(cuts=[cut(3, 4)]), SEGS, 30, CFG)
    assert out[0].transcript.startswith("E o pior")


def test_drops_duplicates_invalid_and_keeps_best():
    resp = LLMResponse(cuts=[cut(0, 1, 60), cut(0, 2, 90), cut(5, 99, 99), cut(5, 7, 70)])
    out = editorial.postprocess(resp, SEGS, 30, CFG)
    assert [c.editorial_score for c in out] == [90, 70]


def test_respects_max_duration_and_excluded_ranges():
    out = editorial.postprocess(LLMResponse(cuts=[cut(0, 7)]), SEGS, 30, CFG)
    assert out and out[0].duration <= 25.5 and out[0].transcript.endswith(".")
    assert editorial.postprocess(LLMResponse(cuts=[cut(0, 1)]), SEGS, 30, CFG, exclude=[(0, 9)]) == []


def test_score_is_clamped_and_config_validated():
    assert editorial.postprocess(LLMResponse(cuts=[cut(0, 1, 250)]), SEGS, 30, CFG)[0].editorial_score == 100
    with pytest.raises(ValueError):
        AnalysisConfig(min_clips=8, max_clips=3)


def test_prompt_contains_only_text_and_timestamps():
    p = editorial.build_prompt(SEGS, CFG, "pt", "De Mala y Cuia")
    assert "[0] 00:00.5-00:04.0 | Hoje a gente" in p and "words" not in p


def test_analyze_without_key_gives_clear_error(client):
    with pytest.raises(editorial.EditorialError, match="ANTHROPIC_API_KEY"):
        editorial.analyze(fake_transcript(), 30, CFG)


def test_path_traversal_blocked(client):
    for bad in ("../../etc/passwd", "/etc/passwd", "projects/../../x"):
        with pytest.raises(storage.StorageError):
            storage.resolve(bad)
    assert storage.safe_display_name("../../evil/..\\a b?.mp4") == "a b_.mp4"


def test_srt_and_ass():
    assert "00:00:00,500 --> 00:00:04,000" in subtitles.to_srt(SEGS)
    style = subtitles.PRESETS["dinamico"]
    pic = framing.picture_area("fit", 1280, 720, 1080, 1920)
    ass, warnings = subtitles.build_ass(SEGS, 4.0, 16.5, style, 1080, 1920, pic)
    assert not warnings and "Dialogue:" in ass and "PASSAPORTE" in ass
    y = subtitles.subtitle_y(style, 1920, pic)[0]
    assert y > pic[1] + pic[3]  # modo fit: legenda abaixo da imagem, nunca sobre as pessoas
    _, w = subtitles.subtitle_y(style, 1920, framing.picture_area("crop", 1280, 720, 1080, 1920))
    assert w  # recorte sem detecção de rostos: avisa em vez de prometer


def test_framing_never_hides_participants():
    wide = [framing.FaceBox(0, 0.05, 0.3, 0.15, 0.2), framing.FaceBox(0, 0.8, 0.3, 0.15, 0.2)]
    plan = framing.plan_framing("smart", 0.5, 1920, 1080, 1080, 1920, wide)
    assert plan.mode == "fit" and plan.warnings
    close = [framing.FaceBox(0, 0.40, 0.3, 0.08, 0.2), framing.FaceBox(0, 0.52, 0.3, 0.08, 0.2)]
    assert framing.plan_framing("smart", 0.5, 1920, 1080, 1080, 1920, close).mode == "crop"
    assert framing.plan_framing("smart", 0.5, 1920, 1080, 1080, 1920, []).mode == "fit"
