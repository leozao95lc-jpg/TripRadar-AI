from modules.price_monitoring.application.use_cases import (
    PRICE_SNAPSHOT_COLLECTED,
    GetPriceHistory,
    PollRoutePrice,
    RouteQuery,
)
from modules.price_monitoring.infrastructure.repository import InMemoryPriceSnapshotRepository
from modules.providers.infrastructure.mock_provider import MockFlightProvider


def test_poll_route_price_persists_snapshot_and_records_pending_event():
    repo = InMemoryPriceSnapshotRepository()
    poll = PollRoutePrice(MockFlightProvider(), repo)

    query = RouteQuery("FLN", "MAD", "2026-11-10", "2026-11-24", "economy")
    snapshots = poll.execute(query, source_provider="mock")

    assert len(snapshots) == 1
    assert snapshots[0].price_cents > 0
    assert snapshots[0].currency == "BRL"
    assert len(poll.pending_events) == 1
    assert poll.pending_events[0].name == PRICE_SNAPSHOT_COLLECTED
    assert poll.pending_events[0].payload["origin_iata"] == "FLN"


def test_poll_route_price_resets_pending_events_on_each_call():
    repo = InMemoryPriceSnapshotRepository()
    poll = PollRoutePrice(MockFlightProvider(), repo)

    poll.execute(RouteQuery("FLN", "MAD", "2026-11-10", "2026-11-24", "economy"), source_provider="mock")
    poll.execute(RouteQuery("GRU", "LIS", "2026-10-05", "2026-10-19", "economy"), source_provider="mock")

    assert len(poll.pending_events) == 1
    assert poll.pending_events[0].payload["origin_iata"] == "GRU"


def test_get_price_history_filters_by_route_and_cabin_class():
    repo = InMemoryPriceSnapshotRepository()
    poll = PollRoutePrice(MockFlightProvider(), repo)

    poll.execute(RouteQuery("FLN", "MAD", "2026-11-10", "2026-11-24", "economy"), source_provider="mock")
    poll.execute(RouteQuery("FLN", "MAD", "2026-11-10", "2026-11-24", "business"), source_provider="mock")
    poll.execute(RouteQuery("GRU", "LIS", "2026-10-05", "2026-10-19", "economy"), source_provider="mock")

    history = GetPriceHistory(repo).execute("FLN", "MAD", "economy", range_days=30)

    assert len(history) == 1
    assert history[0].cabin_class == "economy"
    assert history[0].destination_iata == "MAD"


def test_poll_route_price_honors_provider_reported_source_when_present():
    # Simula um `FallbackFlightProvider` que degradou pra mock nesta chamada
    # específica: o snapshot deve ficar rotulado com o provedor que REALMENTE
    # respondeu, não com o `source_provider` estático passado pelo chamador (ver
    # modules/providers/infrastructure/resilience.py e o comentário em
    # PollRoutePrice.execute).
    class ProviderThatFellBackToMock(MockFlightProvider):
        last_call_source_provider = "mock"

    repo = InMemoryPriceSnapshotRepository()
    poll = PollRoutePrice(ProviderThatFellBackToMock(), repo)

    snapshots = poll.execute(
        RouteQuery("FLN", "MAD", "2026-11-10", "2026-11-24", "economy"), source_provider="amadeus"
    )

    assert snapshots[0].source_provider == "mock"


def test_poll_route_price_uses_static_source_when_provider_does_not_report_one():
    repo = InMemoryPriceSnapshotRepository()
    poll = PollRoutePrice(MockFlightProvider(), repo)

    snapshots = poll.execute(
        RouteQuery("FLN", "MAD", "2026-11-10", "2026-11-24", "economy"), source_provider="mock"
    )

    assert snapshots[0].source_provider == "mock"


def test_mock_provider_is_stable_within_the_same_day():
    provider = MockFlightProvider()
    query = dict(
        origin_iata="FLN",
        destination_iata="MAD",
        departure_date="2026-11-10",
        return_date="2026-11-24",
        cabin_class="economy",
        passengers=1,
    )
    first = provider.search(**query)[0]
    second = provider.search(**query)[0]

    assert first.price_cents == second.price_cents
