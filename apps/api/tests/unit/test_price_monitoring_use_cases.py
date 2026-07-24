from modules.price_monitoring.application.use_cases import GetPriceHistory, PollRoutePrice, RouteQuery
from modules.price_monitoring.infrastructure.repository import InMemoryPriceSnapshotRepository
from modules.providers.infrastructure.mock_provider import MockFlightProvider
from shared.events import event_bus


def test_poll_route_price_persists_snapshot_and_publishes_event():
    repo = InMemoryPriceSnapshotRepository()
    poll = PollRoutePrice(MockFlightProvider(), repo)
    received = []
    event_bus.subscribe("price_snapshot_collected", lambda event: received.append(event))

    query = RouteQuery("FLN", "MAD", "2026-11-10", "2026-11-24", "economy")
    snapshots = poll.execute(query, source_provider="mock")

    assert len(snapshots) == 1
    assert snapshots[0].price_cents > 0
    assert snapshots[0].currency == "BRL"
    assert len(received) == 1
    assert received[0].payload["origin_iata"] == "FLN"


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
