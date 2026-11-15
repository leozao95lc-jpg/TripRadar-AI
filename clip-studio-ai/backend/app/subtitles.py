"""Legendas: SRT para exportação e ASS (libass) para queima no vídeo."""
import re
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

FONTS_DIR = Path(__file__).resolve().parent.parent / "fonts"
BUNDLED_FONTS = ["Montserrat", "Bricolage Grotesque", "Inter", "Space Mono"]
HEX = r"^#[0-9A-Fa-f]{6}$"


class SubtitleStyle(BaseModel):
    font: str = "Montserrat"
    size: int = Field(64, ge=24, le=160)  # px no quadro 1080x1920
    bold: bool = True
    uppercase: bool = False
    color: str = Field("#FFFFFF", pattern=HEX)
    highlight_words: bool = False
    highlight_color: str = Field("#E8622C", pattern=HEX)
    outline_color: str = Field("#000000", pattern=HEX)
    outline_width: float = Field(4, ge=0, le=12)
    background: Literal["none", "box"] = "none"
    background_color: str = Field("#000000", pattern=HEX)
    background_opacity: float = Field(0.6, ge=0, le=1)
    # auto = fora da imagem quando há faixa livre (modo fit); nunca sobre o quadro com pessoas
    position: Literal["auto", "top", "middle", "bottom"] = "auto"
    margin_v: int = Field(260, ge=0, le=900)  # distância da borda (zona segura das redes)
    max_words: int = Field(4, ge=1, le=10)
    animation: Literal["none", "fade", "pop"] = "none"


PRESETS: dict[str, SubtitleStyle] = {
    "clean": SubtitleStyle(font="Inter", size=56, max_words=6, outline_width=3),
    "dinamico": SubtitleStyle(font="Montserrat", size=76, uppercase=True, highlight_words=True,
                              highlight_color="#FFE14D", outline_width=6, max_words=3, animation="pop"),
    "de_mala_y_cuia": SubtitleStyle(font="Bricolage Grotesque", size=70, color="#F4EBDD", highlight_words=True,
                                    highlight_color="#E8622C", outline_color="#1F3D2B", outline_width=6,
                                    max_words=4, animation="fade"),
}


# ---------- SRT ----------
def _ts(t: float, sep: str) -> str:
    ms = int(round(max(0.0, t) * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def to_srt(segments: list[dict], offset: float = 0.0) -> str:
    out = []
    for i, s in enumerate(segments, 1):
        out.append(f"{i}\n{_ts(s['start'] - offset, ',')} --> {_ts(s['end'] - offset, ',')}\n{s['text'].strip()}\n")
    return "\n".join(out)


# ---------- Cues ----------
def clip_words(segments: list[dict], start: float, end: float) -> list[dict]:
    """Palavras (com tempo relativo ao corte) contidas em [start, end]."""
    words: list[dict] = []
    for seg in segments:
        if seg["end"] <= start or seg["start"] >= end:
            continue
        ws = seg.get("words") or []
        if not ws:  # sem timestamps por palavra: distribui uniformemente dentro do segmento
            toks = seg["text"].split()
            step = (seg["end"] - seg["start"]) / max(1, len(toks))
            ws = [{"word": t, "start": seg["start"] + i * step, "end": seg["start"] + (i + 1) * step}
                  for i, t in enumerate(toks)]
        for w in ws:
            mid = (w["start"] + w["end"]) / 2
            if start <= mid <= end and w["word"].strip():
                words.append({"word": w["word"].strip(), "start": max(0.0, w["start"] - start),
                              "end": min(end - start, w["end"] - start)})
    return words


def build_cues(words: list[dict], max_words: int, max_chars: int = 28) -> list[list[dict]]:
    cues, cur = [], []
    for w in words:
        length = sum(len(x["word"]) + 1 for x in cur) + len(w["word"])
        gap = w["start"] - cur[-1]["end"] if cur else 0
        if cur and (len(cur) >= max_words or length > max_chars or gap > 0.7
                    or re.search(r"[.!?…]$", cur[-1]["word"])):
            cues.append(cur)
            cur = []
        cur.append(w)
    if cur:
        cues.append(cur)
    return cues


# ---------- ASS ----------
def _ass_color(hex_: str, alpha: float = 0.0) -> str:
    r, g, b = hex_[1:3], hex_[3:5], hex_[5:7]
    return f"&H{int(round(alpha * 255)):02X}{b}{g}{r}".upper()


def _ass_time(t: float) -> str:
    cs = int(round(max(0.0, t) * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _esc(text: str) -> str:
    return text.replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", " ")


def subtitle_y(style: SubtitleStyle, out_h: int, picture: tuple[int, int, int, int]) -> tuple[int, list[str]]:
    """Posição vertical (centro do texto). `picture` = área ocupada pela imagem original."""
    _, py, _, ph = picture
    warnings: list[str] = []
    band_below = out_h - (py + ph)
    if style.position == "auto":
        if band_below >= style.size * 3:  # faixa livre abaixo da imagem: garante que não cobre rostos
            y = py + ph + min(band_below // 2, max(style.size * 2, 140))
            return min(y, out_h - style.margin_v), warnings
        warnings.append("Sem detecção de rostos neste enquadramento: legenda na zona inferior segura. "
                        "Confira no preview se não cobre ninguém.")
        return out_h - style.margin_v, warnings
    y = {"top": style.margin_v, "middle": out_h // 2, "bottom": out_h - style.margin_v}[style.position]
    if py < y < py + ph:
        warnings.append("Posição manual da legenda fica sobre a imagem; confira se não cobre rostos.")
    return y, warnings


def build_ass(segments: list[dict], start: float, end: float, style: SubtitleStyle,
              out_w: int, out_h: int, picture: tuple[int, int, int, int]) -> tuple[str, list[str]]:
    y, warnings = subtitle_y(style, out_h, picture)
    box = style.background == "box"
    outline_col = _ass_color(style.background_color, 1 - style.background_opacity) if box \
        else _ass_color(style.outline_color)
    head = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {out_w}\nPlayResY: {out_h}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Main,{style.font},{style.size},{_ass_color(style.color)},{_ass_color(style.color)},"
        f"{outline_col},&H80000000,{-1 if style.bold else 0},0,0,0,100,100,0,0,"
        f"{3 if box else 1},{max(style.outline_width, 8) if box else style.outline_width},0,5,60,60,0,1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    base, hi = _ass_color(style.color), _ass_color(style.highlight_color)
    lines = []
    for cue in build_cues(clip_words(segments, start, end), style.max_words):
        toks = [_esc(w["word"].upper() if style.uppercase else w["word"]) for w in cue]
        cue_end = cue[-1]["end"]
        steps = range(len(cue)) if style.highlight_words else [None]
        for n, i in enumerate(steps):
            if i is None:
                t0, t1, text = cue[0]["start"], cue_end, " ".join(toks)
            else:
                t0 = cue[i]["start"]
                t1 = cue[i + 1]["start"] if i + 1 < len(cue) else cue_end
                text = " ".join(f"{{\\c{hi}}}{t}{{\\c{base}}}" if j == i else t for j, t in enumerate(toks))
            if t1 - t0 < 0.02:
                continue
            first, last = n == 0, n == len(cue) - 1 or i is None
            fx = f"\\an5\\pos({out_w // 2},{y})"
            if style.animation == "fade":
                fx += f"\\fad({120 if first else 0},{80 if last else 0})"
            elif style.animation == "pop" and first:
                fx += "\\fscx82\\fscy82\\t(0,110,\\fscx100\\fscy100)"
            lines.append(f"Dialogue: 0,{_ass_time(t0)},{_ass_time(t1)},Main,,0,0,0,,{{{fx}}}{text}")
    return head + "\n".join(lines) + "\n", warnings
