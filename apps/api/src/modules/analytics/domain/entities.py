from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4


@dataclass
class ProductEvent:
    """Um evento de produto (não confundir com `DomainEvent` de `shared/events.py`:
    aquele é o mecanismo de integração entre módulos; este é o REGISTRO, para
    análise posterior, de que uma ação de usuário aconteceu). Muitos `ProductEvent`
    nascem como reação a um `DomainEvent` existente (ver `bootstrap.py`), mas o
    registro sobrevive independente de qualquer handler de negócio."""

    event_name: str
    user_id: UUID | None = None
    properties: dict = field(default_factory=dict)
    id: UUID = field(default_factory=uuid4)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC))
