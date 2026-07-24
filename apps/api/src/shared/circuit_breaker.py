import time
from collections import defaultdict
from enum import StrEnum
from threading import Lock

# Circuit breaker em memória, por processo — mesmo raciocínio do `InMemoryRateLimiter`
# em rate_limit.py: fecha a lacuna mais urgente (nenhum provedor tinha proteção
# alguma contra indisponibilidade prolongada, ver docs/11-provider-integration-
# strategy.md §4) sem introduzir uma dependência nova (pybreaker) para uma máquina de
# estados de três posições que cabe em poucas linhas. NÃO coordena entre réplicas —
# cada instância da API/worker abre e fecha o circuito de forma independente. Isso é
# aceitável aqui porque o efeito de "abrir cedo demais" é só perder uma tentativa a
# mais por réplica, não um problema de corretude (diferente do rate limiter, que
# protege um orçamento compartilhado).


class CircuitState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpenError(Exception):
    """Levantado por `InMemoryCircuitBreaker.before_call` quando o circuito está
    aberto — o chamador não deve nem tentar a chamada."""


class _CircuitEntry:
    __slots__ = ("state", "failure_count", "opened_at")

    def __init__(self) -> None:
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.opened_at: float | None = None


class InMemoryCircuitBreaker:
    def __init__(self) -> None:
        self._entries: dict[str, _CircuitEntry] = defaultdict(_CircuitEntry)
        self._lock = Lock()

    def before_call(self, key: str, failure_threshold: int, cooldown_seconds: float) -> CircuitState:
        """Chamado antes de tentar a operação. Levanta `CircuitOpenError` se o
        circuito está aberto e o cooldown ainda não passou. Se o cooldown já passou,
        move para `HALF_OPEN` e deixa UMA chamada de teste passar."""
        with self._lock:
            entry = self._entries[key]
            if entry.state == CircuitState.OPEN:
                assert entry.opened_at is not None
                if time.monotonic() - entry.opened_at < cooldown_seconds:
                    raise CircuitOpenError(key)
                entry.state = CircuitState.HALF_OPEN
            return entry.state

    def record_success(self, key: str) -> CircuitState | None:
        """Retorna o novo estado só quando ele MUDOU (para o chamador decidir se
        precisa logar/emitir métrica de transição), `None` se não mudou nada."""
        with self._lock:
            entry = self._entries[key]
            previous = entry.state
            entry.failure_count = 0
            entry.state = CircuitState.CLOSED
            entry.opened_at = None
            return CircuitState.CLOSED if previous != CircuitState.CLOSED else None

    def record_failure(self, key: str, failure_threshold: int) -> CircuitState | None:
        with self._lock:
            entry = self._entries[key]
            previous = entry.state
            if entry.state == CircuitState.HALF_OPEN:
                # A chamada de teste do half-open falhou: volta a abrir na hora,
                # sem precisar acumular `failure_threshold` de novo.
                entry.state = CircuitState.OPEN
                entry.opened_at = time.monotonic()
                entry.failure_count = failure_threshold
                return CircuitState.OPEN if previous != CircuitState.OPEN else None

            entry.failure_count += 1
            if entry.failure_count >= failure_threshold:
                entry.state = CircuitState.OPEN
                entry.opened_at = time.monotonic()
                return CircuitState.OPEN if previous != CircuitState.OPEN else None
            return None

    def get_state(self, key: str) -> CircuitState:
        with self._lock:
            return self._entries[key].state

    def reset(self) -> None:
        self._entries.clear()


circuit_breaker = InMemoryCircuitBreaker()
