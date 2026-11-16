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
from typing import Callable, Literal

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
    """Um corte sugerido, delimitado pelos índices do primeiro e do último segmento (inclusive)."""
    # Este schema é enviado à IA (as descrições também). Sem restrições numéricas aqui: a
    # validação estrita acontece em ClipSuggestion, no backend.
    start_segment: int = Field(description="Índice do primeiro segmento do corte")
    end_segment: int = Field(description="Índice do último segmento do corte (inclusive)")
    title: str = Field(description="Título curto do corte")
    hook: str = Field(description="Gancho: frase curta para a tela ou a legenda do post")
    rationale: str = Field(description="Por que este trecho foi escolhido")
    cta: str = Field(description="Chamada para ação sugerida")
    editorial_score: int = Field(description="Avaliação editorial de 0 a 100 (não é previsão de visualizações)")
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
        parts.append("Trechos já aprovados ou descartados pelo usuário (não sugerir de novo nem sobrepor): "
                     + ", ".join(f"{_fmt(a)}-{_fmt(b)}" for a, b in exclude))
    parts.append("<transcricao>\n" + "\n".join(lines) + "\n</transcricao>")
    return "\n\n".join(parts)


def _client():
    import anthropic

    return anthropic.Anthropic(api_key=get_settings().anthropic_api_key, timeout=900.0)


def _api_message(e) -> str:
    body = getattr(e, "body", None)
    msg = (body.get("error") or {}).get("message") if isinstance(body, dict) else None
    return str(msg or getattr(e, "message", "") or e)[:300]


def call_claude(prompt: str, on_usage: Callable[[dict], None] | None = None) -> LLMResponse:
    import anthropic

    s = get_settings()
    if not s.anthropic_api_key:
        raise EditorialError("ANTHROPIC_API_KEY não configurada. Defina a chave no arquivo .env.")
    try:
        # Streaming: a análise de um vídeo longo leva minutos, e uma conexão parada tanto tempo
        # costuma ser derrubada no caminho. A saída é restrita ao schema de LLMResponse; a
        # validação do JSON fica por nossa conta, depois de checar por que a resposta terminou.
        with _client().messages.stream(
            model=s.anthropic_model,
            max_tokens=32000,
            thinking={"type": "adaptive"},
            output_config={"effort": s.anthropic_effort,
                           "format": {"type": "json_schema", "schema": anthropic.transform_schema(LLMResponse)}},
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            resp = stream.get_final_message()
    except anthropic.AuthenticationError as e:
        raise EditorialError("Chave da API Anthropic inválida. Confira ANTHROPIC_API_KEY no arquivo .env.") from e
    except anthropic.RateLimitError as e:
        raise EditorialError("Limite de uso da API Anthropic atingido. Tente novamente em alguns minutos.") from e
    except anthropic.APIStatusError as e:
        if e.status_code >= 500:
            raise EditorialError(f"A API Anthropic está indisponível no momento (HTTP {e.status_code}). "
                                 "Tente novamente em alguns minutos.") from e
        raise EditorialError(f"A API Anthropic rejeitou a requisição (HTTP {e.status_code}): {_api_message(e)}") from e
    except anthropic.APIConnectionError as e:
        raise EditorialError("Não foi possível conectar à API Anthropic. Verifique a internet do servidor.") from e
    except anthropic.APIError as e:  # erro enviado no meio do stream (ex.: sobrecarga)
        raise EditorialError(f"A API Anthropic interrompeu a análise: {_api_message(e)}") from e
    if on_usage and resp.usage:  # a chamada é cobrada mesmo quando a resposta não serve
        on_usage({"model": resp.model, "input_tokens": resp.usage.input_tokens,
                  "output_tokens": resp.usage.output_tokens})
    if resp.stop_reason == "refusal":
        raise EditorialError("A IA recusou analisar este conteúdo.")
    if resp.stop_reason == "max_tokens":
        raise EditorialError("A resposta da IA foi cortada por limite de tamanho. Peça menos cortes e tente de novo.")
    text = next((block.text for block in resp.content if block.type == "text"), "")
    try:
        return LLMResponse.model_validate_json(text)
    except ValidationError as e:
        raise EditorialError("A IA devolveu uma resposta fora do formato esperado. Tente novamente.") from e


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
            exclude: list[tuple[float, float]] | None = None,
            on_usage: Callable[[dict], None] | None = None) -> list[ClipSuggestion]:
    segments = transcript.get("segments") or []
    if not segments:
        raise EditorialError("A transcrição está vazia; não há conteúdo para analisar.")
    prompt = build_prompt(segments, cfg, transcript.get("language", ""), channel_context, exclude)
    clips = postprocess(call_claude(prompt, on_usage), segments, video_duration, cfg, exclude)
    if not clips:
        raise EditorialError("Nenhum trecho atendeu aos critérios de qualidade e duração. "
                             "Ajuste as configurações e tente novamente.")
    return clips
