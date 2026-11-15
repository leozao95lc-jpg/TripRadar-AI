"""AI Editorial Engine.

A Claude recebe SOMENTE a transcrição (texto + timestamps) — nunca áudio ou vídeo — e
devolve cortes referenciados por ÍNDICE DE SEGMENTO. Isso dá três garantias no backend:
  1. o texto do corte é remontado a partir da transcrição real (a IA não consegue inventar falas);
  2. início e fim caem sempre em fronteira de segmento, depois ajustados para fronteira de frase;
  3. timestamps nunca saem da duração do vídeo.
A resposta é validada com Pydantic e depois passa por regras determinísticas (duração,
duplicidade, frases incompletas).
"""
import re
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, model_validator

from .config import get_settings
from .errors import AppError

Category = Literal["historia", "humor", "emocao", "opiniao", "dica", "informacao", "bastidores", "reflexao", "outro"]
SENTENCE_END = re.compile(r"[.!?…][\"'”’)\]]*$")


class EditorialError(AppError):
    pass


class AnalysisConfig(BaseModel):
    min_clips: int = Field(5, ge=1, le=20)
    max_clips: int = Field(10, ge=1, le=20)
    preferred_min_seconds: float = Field(20, ge=5, le=300)
    preferred_max_seconds: float = Field(60, ge=5, le=300)
    max_seconds: float = Field(90, ge=10, le=600)
    instructions: str = Field("", max_length=1000)  # orientação editorial livre do usuário

    @model_validator(mode="after")
    def _coherent(self):
        if self.min_clips > self.max_clips:
            raise ValueError("min_clips não pode ser maior que max_clips")
        if not self.preferred_min_seconds <= self.preferred_max_seconds <= self.max_seconds:
            raise ValueError("Durações devem respeitar: mínima <= preferencial máxima <= máxima")
        return self


class LLMCut(BaseModel):
    """Formato pedido à IA (sem restrições numéricas no schema; a validação estrita é a de baixo)."""
    start_segment: int
    end_segment: int
    title: str
    hook: str
    rationale: str
    cta: str
    editorial_score: int
    category: Category


class LLMResponse(BaseModel):
    cuts: list[LLMCut]


class ClipSuggestion(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    hook: str
    start_time: float = Field(ge=0)
    end_time: float = Field(gt=0)
    duration: float = Field(gt=0)
    transcript: str = Field(min_length=1)
    rationale: str
    cta: str
    editorial_score: int = Field(ge=0, le=100)
    category: Category
    warnings: list[str] = []


SYSTEM = """Você é o editor-chefe de um canal de vídeo e seleciona os melhores momentos de gravações longas \
para virarem vídeos curtos verticais (Reels, Shorts, TikTok).

Você recebe a transcrição numerada por segmento, com timestamps. Escolha trechos avaliando: potencial de prender \
a atenção nos primeiros segundos, clareza da mensagem, histórias interessantes, emoção, humor, identificação com \
o público, opiniões relevantes, informação útil, potencial de compartilhamento e — acima de tudo — autonomia: quem \
nunca viu o vídeo completo precisa entender o trecho sozinho.

Regras:
- Indique cada corte pelos índices do primeiro e do último segmento (inclusive). Segmentos contíguos apenas.
- Comece no início de uma frase e termine no fim de uma frase. Não comece em resposta a algo que ficou de fora \
nem termine antes da conclusão da ideia.
- Não sobreponha cortes e não repita o mesmo assunto em dois cortes.
- Preserve o sentido original: não escolha um recorte que distorça o que a pessoa quis dizer.
- Título, gancho, justificativa e CTA no idioma da transcrição. O gancho é uma frase curta para tela/legenda; \
não atribua a ninguém palavras que não estão na transcrição.
- A justificativa explica, de forma concreta, por que esse trecho foi escolhido.
- editorial_score (0 a 100) é a sua avaliação editorial relativa do trecho, não uma previsão de visualizações. \
Use a escala toda; reserve notas acima de 85 para trechos realmente excepcionais.
- Se o material não sustenta a quantidade pedida com qualidade, devolva menos cortes em vez de forçar trechos fracos."""


def _fmt(t: float) -> str:
    m, s = divmod(t, 60)
    return f"{int(m):02d}:{s:04.1f}"


def build_prompt(segments: list[dict], cfg: AnalysisConfig, language: str, channel_context: str = "",
                 exclude: list[tuple[float, float]] | None = None) -> str:
    lines = [f"[{s['id']}] {_fmt(s['start'])}-{_fmt(s['end'])} | {s['text']}" for s in segments]
    parts = [
        f"Idioma detectado: {language or 'desconhecido'}.",
        f"Quantidade desejada: de {cfg.min_clips} a {cfg.max_clips} cortes.",
        f"Duração preferencial de cada corte: {cfg.preferred_min_seconds:.0f} a {cfg.preferred_max_seconds:.0f} "
        f"segundos. Limite máximo absoluto: {cfg.max_seconds:.0f} segundos.",
    ]
    if channel_context:
        parts.append(f"Contexto do canal: {channel_context}")
    if cfg.instructions:
        parts.append(f"Orientação editorial do usuário: {cfg.instructions}")
    if exclude:
        parts.append("Trechos já aproveitados (não sugerir de novo nem sobrepor): "
                     + ", ".join(f"{_fmt(a)}-{_fmt(b)}" for a, b in exclude))
    parts.append("<transcricao>\n" + "\n".join(lines) + "\n</transcricao>")
    return "\n\n".join(parts)


def call_claude(prompt: str) -> LLMResponse:
    import anthropic

    s = get_settings()
    if not s.anthropic_api_key:
        raise EditorialError("ANTHROPIC_API_KEY não configurada. Defina a chave no arquivo .env.")
    client = anthropic.Anthropic(api_key=s.anthropic_api_key, timeout=900.0)
    try:
        resp = client.messages.parse(
            model=s.anthropic_model,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            output_config={"effort": s.anthropic_effort},
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            output_format=LLMResponse,
        )
    except anthropic.AuthenticationError as e:
        raise EditorialError("Chave da API Anthropic inválida.") from e
    except anthropic.RateLimitError as e:
        raise EditorialError("Limite de uso da API Anthropic atingido. Tente novamente em alguns minutos.") from e
    except anthropic.APIStatusError as e:
        raise EditorialError(f"A API Anthropic recusou a requisição (HTTP {e.status_code}).") from e
    except anthropic.APIConnectionError as e:
        raise EditorialError("Não foi possível conectar à API Anthropic.") from e
    if resp.stop_reason == "refusal":
        raise EditorialError("A IA recusou analisar este conteúdo.")
    if resp.stop_reason == "max_tokens" or resp.parsed_output is None:
        raise EditorialError("A IA não devolveu uma resposta estruturada completa. Tente novamente.")
    return resp.parsed_output


# ---------- Regras determinísticas ----------
def _starts_sentence(segs: list[dict], i: int) -> bool:
    return i == 0 or bool(SENTENCE_END.search(segs[i - 1]["text"].strip()))


def _ends_sentence(segs: list[dict], i: int) -> bool:
    return bool(SENTENCE_END.search(segs[i]["text"].strip()))


def snap_to_sentences(segs: list[dict], a: int, b: int, max_seconds: float) -> tuple[int, int, list[str]]:
    """Ajusta as fronteiras para início/fim de frase, preferindo ampliar (preserva contexto)."""
    warnings: list[str] = []

    def dur(x: int, y: int) -> float:
        return segs[y]["end"] - segs[x]["start"]

    if not _starts_sentence(segs, a):
        back = next((i for i in range(a - 1, max(-1, a - 4), -1) if _starts_sentence(segs, i)), None)
        fwd = next((i for i in range(a + 1, min(b, a + 3) + 1) if _starts_sentence(segs, i)), None)
        if back is not None and dur(back, b) <= max_seconds:
            a = back
        elif fwd is not None:
            a = fwd
        else:
            warnings.append("O corte pode começar no meio de uma frase. Revise o início.")
    if not _ends_sentence(segs, b):
        fwd = next((i for i in range(b + 1, min(len(segs), b + 4)) if _ends_sentence(segs, i)), None)
        back = next((i for i in range(b - 1, max(a, b - 3) - 1, -1) if _ends_sentence(segs, i)), None)
        if fwd is not None and dur(a, fwd) <= max_seconds:
            b = fwd
        elif back is not None:
            b = back
        else:
            warnings.append("O corte pode terminar com a frase incompleta. Revise o fim.")
    return a, b, warnings


def _overlap_ratio(a: tuple[float, float], b: tuple[float, float]) -> float:
    inter = min(a[1], b[1]) - max(a[0], b[0])
    return max(0.0, inter) / max(0.001, min(a[1] - a[0], b[1] - b[0]))


def postprocess(resp: LLMResponse, segments: list[dict], video_duration: float, cfg: AnalysisConfig,
                exclude: list[tuple[float, float]] | None = None) -> list[ClipSuggestion]:
    n = len(segments)
    taken: list[tuple[float, float]] = list(exclude or [])
    out: list[ClipSuggestion] = []
    for cut in sorted(resp.cuts, key=lambda c: -c.editorial_score):
        a, b = cut.start_segment, cut.end_segment
        if not (0 <= a <= b < n):
            continue  # índice inexistente: descartado, nunca "consertado" por chute
        a, b, warnings = snap_to_sentences(segments, a, b, cfg.max_seconds)
        while b > a and segments[b]["end"] - segments[a]["start"] > cfg.max_seconds:
            b -= 1  # excedeu o limite: encurta pelo fim até a última frase que cabe
            while b > a and not _ends_sentence(segments, b):
                b -= 1
        # folga curta para não comer a primeira/última sílaba, sem invadir a fala vizinha
        start = max(segments[a - 1]["end"] if a else 0.0, segments[a]["start"] - 0.15, 0.0)
        end = min(segments[b + 1]["start"] if b + 1 < n else video_duration, segments[b]["end"] + 0.25,
                  video_duration)
        duration = end - start
        if duration > cfg.max_seconds + 0.5 or duration < 5:
            continue
        if any(_overlap_ratio((start, end), t) > 0.3 for t in taken):
            continue  # duplicado / sobreposto a um corte melhor pontuado ou já aprovado
        if duration < cfg.preferred_min_seconds:
            warnings.append("Duração abaixo da faixa preferencial.")
        elif duration > cfg.preferred_max_seconds:
            warnings.append("Duração acima da faixa preferencial.")
        try:
            out.append(ClipSuggestion(
                title=cut.title.strip()[:300], hook=cut.hook.strip(), start_time=round(start, 3),
                end_time=round(end, 3), duration=round(duration, 3),
                transcript=" ".join(s["text"].strip() for s in segments[a:b + 1]),
                rationale=cut.rationale.strip(), cta=cut.cta.strip(),
                editorial_score=max(0, min(100, cut.editorial_score)), category=cut.category, warnings=warnings,
            ))
        except ValidationError:
            continue
        taken.append((start, end))
        if len(out) >= cfg.max_clips:
            break
    return out


def analyze(transcript: dict, video_duration: float, cfg: AnalysisConfig, channel_context: str = "",
            exclude: list[tuple[float, float]] | None = None) -> list[ClipSuggestion]:
    segments = transcript.get("segments") or []
    if not segments:
        raise EditorialError("A transcrição está vazia; não há conteúdo para analisar.")
    prompt = build_prompt(segments, cfg, transcript.get("language", ""), channel_context, exclude)
    clips = postprocess(call_claude(prompt), segments, video_duration, cfg, exclude)
    if not clips:
        raise EditorialError("Nenhum trecho atendeu aos critérios de qualidade e duração. "
                             "Ajuste as configurações e tente novamente.")
    return clips
