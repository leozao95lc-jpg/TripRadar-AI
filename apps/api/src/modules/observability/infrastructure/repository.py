from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.observability.application.ports import WorkerRunRepository
from modules.observability.domain.entities import WorkerRun
from modules.observability.infrastructure.models import WorkerRunModel


def _to_domain(row: WorkerRunModel) -> WorkerRun:
    return WorkerRun(
        id=UUID(str(row.id)),
        worker_name=row.worker_name,
        started_at=row.started_at,
        finished_at=row.finished_at,
        success=row.success,
        routes_ok=row.routes_ok,
        routes_failed=row.routes_failed,
        error_message=row.error_message,
        recorded_at=row.recorded_at,
    )


class SqlAlchemyWorkerRunRepository(WorkerRunRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, run: WorkerRun) -> None:
        self._session.add(
            WorkerRunModel(
                id=str(run.id),
                worker_name=run.worker_name,
                started_at=run.started_at,
                finished_at=run.finished_at,
                success=run.success,
                routes_ok=run.routes_ok,
                routes_failed=run.routes_failed,
                error_message=run.error_message,
                recorded_at=run.recorded_at,
            )
        )
        self._session.flush()

    def get_latest(self, worker_name: str) -> WorkerRun | None:
        row = self._session.execute(
            select(WorkerRunModel)
            .where(WorkerRunModel.worker_name == worker_name)
            .order_by(WorkerRunModel.recorded_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        return _to_domain(row) if row is not None else None

    def list_latest_per_worker(self) -> list[WorkerRun]:
        rows = (
            self._session.execute(select(WorkerRunModel).order_by(WorkerRunModel.recorded_at.desc()))
            .scalars()
            .all()
        )
        latest_by_worker: dict[str, WorkerRunModel] = {}
        for row in rows:
            latest_by_worker.setdefault(row.worker_name, row)
        return [_to_domain(row) for row in latest_by_worker.values()]


class InMemoryWorkerRunRepository(WorkerRunRepository):
    def __init__(self) -> None:
        self._runs: list[WorkerRun] = []

    def add(self, run: WorkerRun) -> None:
        self._runs.append(run)

    def get_latest(self, worker_name: str) -> WorkerRun | None:
        matching = [r for r in self._runs if r.worker_name == worker_name]
        return max(matching, key=lambda r: r.recorded_at) if matching else None

    def list_latest_per_worker(self) -> list[WorkerRun]:
        latest_by_worker: dict[str, WorkerRun] = {}
        for run in sorted(self._runs, key=lambda r: r.recorded_at, reverse=True):
            latest_by_worker.setdefault(run.worker_name, run)
        return list(latest_by_worker.values())
