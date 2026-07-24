from abc import ABC, abstractmethod
from datetime import datetime

from modules.analytics.domain.entities import ProductEvent


class ProductEventRepository(ABC):
    @abstractmethod
    def add(self, event: ProductEvent) -> None: ...

    @abstractmethod
    def count_by_event_name_since(self, since: datetime) -> dict[str, int]:
        """Contagem por `event_name`, só dos eventos ocorridos a partir de `since` —
        é o que alimenta o resumo do dashboard administrativo (ex.: "42
        alert_created nos últimos 7 dias")."""
        ...
