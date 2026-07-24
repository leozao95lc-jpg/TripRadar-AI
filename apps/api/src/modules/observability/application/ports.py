from abc import ABC, abstractmethod

from modules.observability.domain.entities import WorkerRun


class WorkerRunRepository(ABC):
    @abstractmethod
    def add(self, run: WorkerRun) -> None: ...

    @abstractmethod
    def get_latest(self, worker_name: str) -> WorkerRun | None: ...

    @abstractmethod
    def list_latest_per_worker(self) -> list[WorkerRun]:
        """Um registro por `worker_name` distinto — o mais recente de cada. Usado pelo
        dashboard administrativo e pelo endpoint `/metrics` para reportar o heartbeat
        de todos os workers conhecidos numa só consulta."""
        ...
