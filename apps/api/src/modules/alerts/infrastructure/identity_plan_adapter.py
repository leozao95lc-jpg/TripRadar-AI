from uuid import UUID

from modules.alerts.application.ports import UserPlanPort
from modules.identity.application.ports import UserRepository

_MAX_ACTIVE_ALERTS_BY_PLAN: dict[str, int | None] = {
    "free": 3,
    "premium": None,
}


class IdentityUserPlanAdapter(UserPlanPort):
    """Implementa a porta `UserPlanPort` (definida por `alerts`) usando apenas a
    interface pública de `identity` (`UserRepository`) — nunca o `infrastructure` ou
    `domain` de `identity` diretamente. É o composition root (interface/routes.py) que
    injeta um `SqlAlchemyUserRepository` real aqui; `alerts/application` nunca sabe
    disso."""

    def __init__(self, users: UserRepository) -> None:
        self._users = users

    def get_max_active_alerts(self, user_id: UUID) -> int | None:
        user = self._users.get_by_id(user_id)
        if user is None:
            return _MAX_ACTIVE_ALERTS_BY_PLAN["free"]
        return _MAX_ACTIVE_ALERTS_BY_PLAN.get(user.plan.value, 3)
