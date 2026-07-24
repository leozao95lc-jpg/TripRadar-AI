from uuid import uuid4

import pytest

from modules.alerts.application.ports import UserPlanPort
from modules.alerts.application.use_cases import (
    AlertLimitReachedError,
    CreateAlert,
    CreateAlertInput,
    DeleteAlert,
    EvaluateAlertsForRoute,
    ListUserAlerts,
)
from modules.alerts.infrastructure.repository import (
    InMemoryAlertRepository,
    InMemoryAlertTriggerRepository,
)


class FakePlanPort(UserPlanPort):
    def __init__(self, max_alerts: int | None) -> None:
        self._max_alerts = max_alerts

    def get_max_active_alerts(self, user_id) -> int | None:
        return self._max_alerts


def _alert_input(**overrides) -> CreateAlertInput:
    defaults = dict(
        user_id=uuid4(),
        origin_iata="fln",
        destination_iata="mad",
        trip_type="round_trip",
        departure_date="2026-11-10",
        max_price_cents=300_000,
    )
    defaults.update(overrides)
    return CreateAlertInput(**defaults)


def test_create_alert_normalizes_airport_codes_to_uppercase():
    repo = InMemoryAlertRepository()
    alert = CreateAlert(repo, FakePlanPort(None)).execute(_alert_input())

    assert alert.origin_iata == "FLN"
    assert alert.destination_iata == "MAD"


def test_create_alert_enforces_free_plan_limit():
    repo = InMemoryAlertRepository()
    use_case = CreateAlert(repo, FakePlanPort(max_alerts=3))
    user_id = uuid4()

    for _ in range(3):
        use_case.execute(_alert_input(user_id=user_id))

    with pytest.raises(AlertLimitReachedError):
        use_case.execute(_alert_input(user_id=user_id))


def test_premium_plan_has_no_alert_limit():
    repo = InMemoryAlertRepository()
    use_case = CreateAlert(repo, FakePlanPort(max_alerts=None))
    user_id = uuid4()

    for _ in range(10):
        use_case.execute(_alert_input(user_id=user_id))

    assert len(ListUserAlerts(repo).execute(user_id)) == 10


def test_delete_alert_removes_it_from_repository():
    repo = InMemoryAlertRepository()
    alert = CreateAlert(repo, FakePlanPort(None)).execute(_alert_input())

    DeleteAlert(repo).execute(alert.id, alert.user_id)

    assert repo.get_by_id(alert.id) is None


def test_evaluate_alerts_for_route_fires_when_price_is_at_or_below_target():
    alerts_repo = InMemoryAlertRepository()
    triggers_repo = InMemoryAlertTriggerRepository()
    alert = CreateAlert(alerts_repo, FakePlanPort(None)).execute(
        _alert_input(max_price_cents=300_000)
    )

    fired = EvaluateAlertsForRoute(alerts_repo, triggers_repo).execute(
        origin_iata="FLN",
        destination_iata="MAD",
        cabin_class="economy",
        price_cents=299_000,
        currency="BRL",
        price_snapshot_id=uuid4(),
    )

    assert len(fired) == 1
    assert triggers_repo.list_by_alert(alert.id)[0].price_at_trigger_cents == 299_000


def test_evaluate_alerts_for_route_does_not_fire_above_target():
    alerts_repo = InMemoryAlertRepository()
    triggers_repo = InMemoryAlertTriggerRepository()
    CreateAlert(alerts_repo, FakePlanPort(None)).execute(_alert_input(max_price_cents=100_000))

    fired = EvaluateAlertsForRoute(alerts_repo, triggers_repo).execute(
        origin_iata="FLN",
        destination_iata="MAD",
        cabin_class="economy",
        price_cents=299_000,
        currency="BRL",
        price_snapshot_id=uuid4(),
    )

    assert fired == []
