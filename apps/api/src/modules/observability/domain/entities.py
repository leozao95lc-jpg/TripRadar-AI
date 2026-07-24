from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4


@dataclass
class WorkerRun:
    """Um registro de execução de um worker em batch (ex.: price_polling_worker).
    Como o worker é um processo curto que termina a cada execução, ele não pode expor
    `/metrics` diretamente — persiste aqui, e a API (processo de vida longa) lê o
    último registro para expor como gauge Prometheus e para o dashboard administrativo
    saber se o worker está rodando (heartbeat)."""

    worker_name: str
    started_at: datetime
    finished_at: datetime
    success: bool
    routes_ok: int = 0
    routes_failed: int = 0
    error_message: str | None = None
    # Campos específicos de workers que chamam um FlightSearchProvider (ver
    # docs/11-provider-integration-strategy.md §7) — `provider_name=None` para
    # workers que não usam provedor nenhum; os demais ficam 0 nesse caso.
    provider_name: str | None = None
    provider_requests: int = 0
    provider_requests_failed: int = 0
    provider_cache_hits: int = 0
    provider_cache_misses: int = 0
    provider_fallback_used: int = 0
    provider_circuit_state: str | None = None
    id: UUID = field(default_factory=uuid4)
    recorded_at: datetime = field(default_factory=lambda: datetime.now(UTC))
