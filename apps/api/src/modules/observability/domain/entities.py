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
    id: UUID = field(default_factory=uuid4)
    recorded_at: datetime = field(default_factory=lambda: datetime.now(UTC))
