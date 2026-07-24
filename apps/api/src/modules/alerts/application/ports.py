from abc import ABC, abstractmethod
from uuid import UUID

from modules.alerts.domain.entities import AlertTrigger, SearchAlert


class AlertRepository(ABC):
    @abstractmethod
    def add(self, alert: SearchAlert) -> None: ...

    @abstractmethod
    def get_by_id(self, alert_id: UUID) -> SearchAlert | None: ...

    @abstractmethod
    def list_by_user(self, user_id: UUID) -> list[SearchAlert]: ...

    @abstractmethod
    def count_active_by_user(self, user_id: UUID) -> int: ...

    @abstractmethod
    def delete(self, alert_id: UUID) -> None: ...

    @abstractmethod
    def list_active_matching_route(
        self, origin_iata: str, destination_iata: str, cabin_class: str
    ) -> list[SearchAlert]: ...

    @abstractmethod
    def list_distinct_active_routes(self) -> list[SearchAlert]:
        """Uma linha por rota+data+classe ativa — usada pelo worker de polling para saber
        o que monitorar, sem que o motor de preços precise conhecer o módulo `alerts`."""
        ...


class AlertTriggerRepository(ABC):
    @abstractmethod
    def add(self, trigger: AlertTrigger) -> None: ...

    @abstractmethod
    def list_by_alert(self, alert_id: UUID) -> list[AlertTrigger]: ...


class UserPlanPort(ABC):
    """Porta definida (e possuída) pelo módulo `alerts`; `identity` fornece o adapter
    concreto. `alerts` nunca importa `identity.domain`/`identity.infrastructure`."""

    @abstractmethod
    def get_max_active_alerts(self, user_id: UUID) -> int | None:
        """None = sem limite (plano Premium)."""
        ...
