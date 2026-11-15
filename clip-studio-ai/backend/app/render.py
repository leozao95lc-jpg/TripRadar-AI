"""Renderização vertical com FFmpeg: corte, enquadramento, legendas queimadas, áudio, fade e logo."""
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from . import framing, media
from .config import get_settings
from .subtitles import FONTS_DIR, PRESETS as SUB_PRESETS, SubtitleStyle, build_ass

# Os três destinos usam 1080x1920 H.264/AAC; mudam limite de duração e zona segura da interface.
PRESETS = {
    "reels": {"label": "Instagram Reels", "width": 1080, "height": 1920, "max_seconds": 90, "safe_bottom": 320},
    "shorts": {"label": "YouTube Shorts", "width": 1080, "height": 1920, "max_seconds": 180, "safe_bottom": 280},
    "tiktok": {"label": "TikTok", "width": 1080, "height": 1920, "max_seconds": 600, "safe_bottom": 340},
}


class RenderOptions(BaseModel):
    preset: Literal["reels", "shorts", "tiktok"] = "reels"
    framing: Literal["fit", "crop", "smart"] = "fit"
    focus_x: float = Field(0.5, ge=0, le=1)
    fps: int | None = Field(None, ge=12, le=60)  # None = preserva o FPS de origem
    normalize_audio: bool = True
    fade: bool = False
    fade_seconds: float = Field(0.4, ge=0.1, le=2)
    logo: bool = False
    logo_position: Literal["top_left", "top_right"] = "top_right"
    subtitles: bool = True
    subtitle_preset: str = "de_mala_y_cuia"
    subtitle_style: SubtitleStyle | None = None  # sobrescreve o preset


def resolve_style(opts: RenderOptions, custom: dict | None = None) -> SubtitleStyle:
    if opts.subtitle_style:
        return opts.subtitle_style
    if custom and opts.subtitle_preset in custom:
        return SubtitleStyle(**custom[opts.subtitle_preset])
    return SUB_PRESETS.get(opts.subtitle_preset, SUB_PRESETS["clean"])


def _fesc(p: Path) -> str:
    return str(p).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")


def build(src: Path, dst: Path, start: float, end: float, opts: RenderOptions, src_w: int, src_h: int,
          has_audio: bool, segments: list[dict], work_dir: Path, logo: Path | None = None,
          custom_presets: dict | None = None, hdr_transfer: str | None = None) -> tuple[list[str], list[str]]:
    """Monta os argumentos do ffmpeg. Devolve (args, avisos)."""
    p = PRESETS[opts.preset]
    W, H = p["width"], p["height"]
    dur = end - start
    plan = framing.plan_framing(opts.framing, opts.focus_x, src_w, src_h, W, H,
                                framing.get_detector().detect(src, start, end) if opts.framing == "smart" else None)
    warnings = list(plan.warnings)
    if dur > p["max_seconds"]:
        warnings.append(f"Duração acima do limite usual de {p['label']} ({p['max_seconds']}s).")
    tonemap = media.tonemap_chain(hdr_transfer)
    if hdr_transfer and not tonemap:
        warnings.append("Vídeo HDR e este FFmpeg não tem os filtros zscale/tonemap: as cores podem sair lavadas.")
    fc = framing.video_filter(plan, W, H, tonemap)
    last = "framed"
    if opts.subtitles and segments:
        style = resolve_style(opts, custom_presets)
        style = style.model_copy(update={"margin_v": max(style.margin_v, p["safe_bottom"])})
        ass, w = build_ass(segments, start, end, style, W, H, framing.picture_area(plan.mode, src_w, src_h, W, H))
        warnings += w
        ass_path = work_dir / "subs.ass"
        ass_path.write_text(ass, encoding="utf-8")
        fc += f";[{last}]ass='{_fesc(ass_path)}':fontsdir='{_fesc(FONTS_DIR)}'[subbed]"
        last = "subbed"
    inputs = ["-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(src)]
    idx = 1
    if opts.logo and logo and logo.is_file():
        inputs += ["-i", str(logo)]
        x = "48" if opts.logo_position == "top_left" else "W-w-48"
        fc += f";[{idx}:v]scale={int(W * 0.2)}:-1[lg];[{last}][lg]overlay={x}:140[logoed]"
        last, idx = "logoed", idx + 1
    f = min(opts.fade_seconds, dur / 3)
    if opts.fade:
        fc += f";[{last}]fade=t=in:st=0:d={f:.2f},fade=t=out:st={dur - f:.2f}:d={f:.2f}[faded]"
        last = "faded"
    fc += f";[{last}]format=yuv420p[vout]"
    if has_audio:
        chain = ["loudnorm=I=-14:TP=-1.5:LRA=11"] if opts.normalize_audio else []
        if opts.fade:
            chain += [f"afade=t=in:st=0:d={f:.2f}", f"afade=t=out:st={dur - f:.2f}:d={f:.2f}"]
        fc += f";[0:a]{','.join(chain + ['aresample=48000'])}[aout]"
    else:  # redes sociais esperam faixa de áudio: gera silêncio
        inputs += ["-f", "lavfi", "-t", f"{dur:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
        fc += f";[{idx}:a]anull[aout]"
    s = get_settings()
    args = [*inputs, "-filter_complex", fc, "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", s.render_preset, "-crf", str(s.render_crf), "-profile:v", "high",
            *(["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"] if tonemap else []),
            *(["-r", str(opts.fps)] if opts.fps else []),
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", f"{dur:.3f}", str(dst)]
    return args, warnings
