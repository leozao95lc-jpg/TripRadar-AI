from datetime import datetime

from modules.observability.application.ports import WorkerRunRepository
from modules.observability.domain.entities import WorkerRun


class RecordWorkerRun:
    def __init__(self, runs: WorkerRunRepository) -> None:
        self._runs = runs

    def execute(
        self,
        *,
        worker_name: str,
        started_at: datetime,
        finished_at: datetime,
        success: bool,
        routes_ok: int = 0,
        routes_failed: int = 0,
        error_message: str | None = None,
        provider_name: str | None = None,
        provider_requests: int = 0,
        provider_requests_failed: int = 0,
        provider_cache_hits: int = 0,
        provider_cache_misses: int = 0,
        provider_fallback_used: int = 0,
        provider_circuit_state: str | None = None,
    ) -> WorkerRun:
        run = WorkerRun(
            worker_name=worker_name,
            started_at=started_at,
            finished_at=finished_at,
            success=success,
            routes_ok=routes_ok,
            routes_failed=routes_failed,
            error_message=error_message,
            provider_name=provider_name,
            provider_requests=provider_requests,
            provider_requests_failed=provider_requests_failed,
            provider_cache_hits=provider_cache_hits,
            provider_cache_misses=provider_cache_misses,
            provider_fallback_used=provider_fallback_used,
            provider_circuit_state=provider_circuit_state,
        )
        self._runs.add(run)
        return run
