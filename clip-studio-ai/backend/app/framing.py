"""Enquadramento vertical.

REGRA FUNDAMENTAL: nunca ocultar automaticamente um participante. Por isso o padrão é
`fit` (quadro original inteiro sobre fundo desfocado): todos permanecem visíveis.
`crop` só acontece por escolha explícita do usuário, com foco horizontal definido por ele.

Fase 2 (MediaPipe): implementar `FaceDetector` e registrar em `get_detector()`. O plano
de enquadramento já recebe as caixas de rosto; se a união dos rostos não couber em 9:16
com qualidade, `plan_framing` devolve `fit` + aviso em vez de cortar alguém.
"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol


@dataclass
class FaceBox:
    t: float  # segundo do vídeo
    x: float  # 0..1 (relativos ao quadro)
    y: float
    w: float
    h: float


class FaceDetector(Protocol):
    def detect(self, video: Path, start: float, end: float) -> list[FaceBox]: ...


class NullDetector:
    """MVP: sem detecção. Não inventamos posição de rosto."""

    def detect(self, video: Path, start: float, end: float) -> list[FaceBox]:
        return []


def get_detector() -> FaceDetector:
    return NullDetector()


@dataclass
class FramingPlan:
    mode: str  # fit | crop
    focus_x: float = 0.5  # centro horizontal do recorte (0..1), usado em crop
    warnings: list[str] = field(default_factory=list)


def plan_framing(mode: str, focus_x: float, src_w: int, src_h: int, out_w: int, out_h: int,
                 faces: list[FaceBox] | None = None) -> FramingPlan:
    if mode == "smart":
        if not faces:
            return FramingPlan("fit", warnings=["Detecção de rostos indisponível: usando enquadramento completo."])
        left = min(f.x for f in faces)
        right = max(f.x + f.w for f in faces)
        visible = min(1.0, (out_w / out_h) / (src_w / src_h))  # fração da largura que sobra no crop
        if right - left > visible * 0.92:
            return FramingPlan("fit", warnings=["Nem todos os participantes cabem no recorte vertical; "
                                                "mantido o quadro completo. Ajuste manualmente se preferir."])
        return FramingPlan("crop", focus_x=(left + right) / 2)
    if mode == "crop":
        return FramingPlan("crop", focus_x=min(1.0, max(0.0, focus_x)),
                           warnings=["Recorte manual: confira se todos os participantes relevantes estão visíveis."])
    return FramingPlan("fit")


def video_filter(plan: FramingPlan, out_w: int, out_h: int, tonemap: str | None = None) -> str:
    """Trecho de filtergraph [0:v] -> [framed]. O tonemap (HDR -> SDR) entra depois da redução
    de resolução, onde custa muito menos."""
    tm = f",{tonemap}" if tonemap else ""
    if plan.mode == "crop":
        return (f"[0:v]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,"
                f"crop={out_w}:{out_h}:(iw-{out_w})*{plan.focus_x:.4f}:(ih-{out_h})/2{tm},setsar=1[framed]")
    # fit: o quadro inteiro, reduzido, sobre uma cópia dele mesmo ampliada e desfocada
    return (f"[0:v]scale={out_w}:{out_h}:force_original_aspect_ratio=decrease:force_divisible_by=2{tm},"
            f"split[fgsrc][bgsrc];"
            f"[bgsrc]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,crop={out_w}:{out_h},"
            f"boxblur=24:4,eq=brightness=-0.12[bg];"
            f"[bg][fgsrc]overlay=(W-w)/2:(H-h)/2,setsar=1[framed]")


def picture_area(mode: str, src_w: int, src_h: int, out_w: int, out_h: int) -> tuple[int, int, int, int]:
    if mode == "crop":
        return 0, 0, out_w, out_h
    scale = min(out_w / src_w, out_h / src_h)
    w, h = int(src_w * scale), int(src_h * scale)
    return (out_w - w) // 2, (out_h - h) // 2, w, h
