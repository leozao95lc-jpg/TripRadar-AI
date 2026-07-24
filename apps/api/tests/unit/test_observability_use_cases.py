from datetime import UTC, datetime, timedelta

from modules.observability.application.use_cases import RecordWorkerRun
from modules.observability.infrastructure.repository import InMemoryWorkerRunRepository


def test_record_worker_run_stores_outcome():
    runs = InMemoryWorkerRunRepository()
    started = datetime.now(UTC) - timedelta(seconds=5)
    finished = datetime.now(UTC)
    run = RecordWorkerRun(runs).execute(
        worker_name="price_polling_worker",
        started_at=started,
        finished_at=finished,
        success=True,
        routes_ok=5,
        routes_failed=0,
    )
    assert run.success is True
    assert runs.get_latest("price_polling_worker") == run


def test_get_latest_returns_the_most_recent_run_for_that_worker():
    runs = InMemoryWorkerRunRepository()
    record = RecordWorkerRun(runs)
    older = record.execute(
        worker_name="w",
        started_at=datetime.now(UTC) - timedelta(minutes=10),
        finished_at=datetime.now(UTC) - timedelta(minutes=9),
        success=True,
    )
    newer = record.execute(
        worker_name="w",
        started_at=datetime.now(UTC),
        finished_at=datetime.now(UTC),
        success=False,
        routes_failed=3,
    )
    latest = runs.get_latest("w")
    assert latest.id == newer.id
    assert latest.id != older.id


def test_list_latest_per_worker_returns_one_entry_per_distinct_worker():
    runs = InMemoryWorkerRunRepository()
    record = RecordWorkerRun(runs)
    now = datetime.now(UTC)
    record.execute(worker_name="worker_a", started_at=now, finished_at=now, success=True)
    record.execute(worker_name="worker_b", started_at=now, finished_at=now, success=True)
    record.execute(worker_name="worker_a", started_at=now, finished_at=now, success=False)

    latest = runs.list_latest_per_worker()
    assert {r.worker_name for r in latest} == {"worker_a", "worker_b"}
    worker_a_entry = next(r for r in latest if r.worker_name == "worker_a")
    assert worker_a_entry.success is False
