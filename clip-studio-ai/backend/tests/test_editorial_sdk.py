"""Chamada à API Claude através do SDK oficial, com o transporte HTTP substituído.

Não substitui o teste com a chave real, mas exercita de verdade o que os outros testes pulam:
a montagem da requisição (schema estruturado, thinking, effort), a leitura do stream de eventos
e a tradução de cada tipo de erro em mensagem para o usuário."""
import json

import anthropic
import httpx2
import pytest

from app import editorial
from app.config import get_settings
from app.editorial import AnalysisConfig, EditorialError
from tests.conftest import fake_transcript

CUTS = {"cuts": [{"start_segment": 0, "end_segment": 1, "title": "O passaporte vencido", "hook": "No balcão",
                  "rationale": "História completa.", "cta": "Salve", "editorial_score": 88, "category": "historia"}]}
CFG = AnalysisConfig(preferred_min_seconds=5, preferred_max_seconds=20, max_seconds=25)


def sse(*events) -> bytes:
    return "".join(f"event: {e['type']}\ndata: {json.dumps(e)}\n\n" for e in events).encode()


def stream_body(text: str, stop_reason: str = "end_turn") -> bytes:
    half = len(text) // 2
    return sse(
        {"type": "message_start", "message": {"id": "msg_1", "type": "message", "role": "assistant",
                                              "model": "claude-opus-5-5", "content": [], "stop_reason": None,
                                              "stop_sequence": None, "usage": {"input_tokens": 1234, "output_tokens": 1}}},
        {"type": "content_block_start", "index": 0, "content_block": {"type": "thinking", "thinking": "", "signature": ""}},
        {"type": "content_block_stop", "index": 0},
        {"type": "content_block_start", "index": 1, "content_block": {"type": "text", "text": ""}},
        {"type": "content_block_delta", "index": 1, "delta": {"type": "text_delta", "text": text[:half]}},
        {"type": "content_block_delta", "index": 1, "delta": {"type": "text_delta", "text": text[half:]}},
        {"type": "content_block_stop", "index": 1},
        {"type": "message_delta", "delta": {"stop_reason": stop_reason, "stop_sequence": None},
         "usage": {"output_tokens": 567}},
        {"type": "message_stop"},
    )


@pytest.fixture()
def api(client, monkeypatch):
    """Devolve (configurar_resposta, requisições_capturadas)."""
    settings = get_settings().model_copy(update={"anthropic_api_key": "sk-ant-teste"})
    monkeypatch.setattr(editorial, "get_settings", lambda: settings)
    state = {"response": None, "requests": []}

    def handler(request: httpx2.Request) -> httpx2.Response:
        state["requests"].append({"url": str(request.url), "headers": dict(request.headers),
                                  "body": json.loads(request.content)})
        return state["response"]

    monkeypatch.setattr(editorial, "_client", lambda: anthropic.Anthropic(
        api_key="sk-ant-teste", max_retries=0, http_client=httpx2.Client(transport=httpx2.MockTransport(handler))))

    def respond(status=200, body=None, text=None, stop_reason="end_turn", raw_stream=None):
        if text is not None or raw_stream is not None:
            content = raw_stream if raw_stream is not None else stream_body(text, stop_reason)
            state["response"] = httpx2.Response(200, content=content, headers={"content-type": "text/event-stream"})
        else:
            state["response"] = httpx2.Response(status, json=body)

    return respond, state["requests"]


def error_body(kind, message):
    return {"type": "error", "error": {"type": kind, "message": message}}


def test_request_shape_and_parsed_result(api):
    respond, requests = api
    respond(text=json.dumps(CUTS))
    usage = []
    clips = editorial.analyze(fake_transcript(), 30, CFG, "De Mala y Cuia — viagens", on_usage=usage.append)

    assert [c.title for c in clips] == ["O passaporte vencido"]
    assert clips[0].transcript.startswith("Hoje a gente vai falar")  # texto vem da transcrição
    assert usage == [{"model": "claude-opus-5-5", "input_tokens": 1234, "output_tokens": 567}]

    (req,) = requests
    body = req["body"]
    assert req["url"].endswith("/v1/messages")
    assert any("sk-ant-teste" in value for value in req["headers"].values())  # chave só no cabeçalho
    assert body["model"] == "claude-opus-5-5" and body["stream"] is True and body["max_tokens"] == 32000
    assert body["thinking"] == {"type": "adaptive"}
    assert body["output_config"]["effort"] == "high"
    schema = body["output_config"]["format"]["schema"]
    assert "cuts" in schema["properties"] and "LLMCut" in json.dumps(schema)
    assert not {"temperature", "top_p", "top_k", "tool_choice"} & body.keys()  # rejeitados por este modelo

    # privacidade: só o texto da transcrição, os timestamps e a configuração saem do servidor
    (message,) = body["messages"]
    assert message["role"] == "user"
    prompt = message["content"] if isinstance(message["content"], str) else message["content"][0]["text"]
    assert "[0] 00:00.5-00:04.0 | Hoje a gente vai falar" in prompt and "De Mala y Cuia" in prompt
    sent = json.dumps(body)
    assert "storage" not in sent and ".mp4" not in sent and '"words"' not in sent
    assert "sk-ant-teste" not in sent


@pytest.mark.parametrize("status,kind,expected", [
    (401, "authentication_error", "Chave da API Anthropic inválida"),
    (429, "rate_limit_error", "Limite de uso"),
    (400, "invalid_request_error", "rejeitou a requisição (HTTP 400): schema inválido"),
    (404, "not_found_error", "rejeitou a requisição (HTTP 404)"),
    (529, "overloaded_error", "indisponível no momento (HTTP 529)"),
])
def test_http_errors_become_clear_messages(api, status, kind, expected):
    respond, _ = api
    respond(status=status, body=error_body(kind, "schema inválido"))
    with pytest.raises(EditorialError, match=expected.replace("(", r"\(").replace(")", r"\)")):
        editorial.analyze(fake_transcript(), 30, CFG)


def test_refusal_truncation_and_malformed_output(api):
    respond, _ = api
    respond(text=json.dumps(CUTS), stop_reason="refusal")
    with pytest.raises(EditorialError, match="recusou"):
        editorial.analyze(fake_transcript(), 30, CFG)
    respond(text=json.dumps(CUTS)[:40], stop_reason="max_tokens")
    usage = []
    with pytest.raises(EditorialError, match="cortada por limite de tamanho"):
        editorial.analyze(fake_transcript(), 30, CFG, on_usage=usage.append)
    assert usage and usage[0]["output_tokens"] == 567  # consumo registrado mesmo sem resultado aproveitável
    respond(text='{"cuts": [{"start_segment": "primeiro"}]}')
    with pytest.raises(EditorialError, match="fora do formato"):
        editorial.analyze(fake_transcript(), 30, CFG)


def test_error_in_the_middle_of_the_stream(api):
    respond, requests = api
    respond(raw_stream=sse(
        {"type": "message_start", "message": {"id": "m", "type": "message", "role": "assistant",
                                              "model": "claude-opus-5-5", "content": [], "stop_reason": None,
                                              "stop_sequence": None, "usage": {"input_tokens": 1, "output_tokens": 1}}},
        {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}},
    ))
    with pytest.raises(EditorialError, match="Anthropic"):
        editorial.analyze(fake_transcript(), 30, CFG)
    assert len(requests) == 1  # erro de negócio: sem repetição cega da chamada (que seria cobrada de novo)


def test_all_cuts_invalid_gives_actionable_message(api):
    respond, _ = api
    bad = {"cuts": [{**CUTS["cuts"][0], "start_segment": 50, "end_segment": 60}]}
    respond(text=json.dumps(bad))
    with pytest.raises(EditorialError, match="Nenhum trecho atendeu"):
        editorial.analyze(fake_transcript(), 30, CFG)
