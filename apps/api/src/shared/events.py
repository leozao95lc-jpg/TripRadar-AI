from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

# Event bus em processo: módulos publicam/assinam eventos de domínio sem se importarem
# diretamente. Quando um módulo (ex.: price_monitoring ou notifications) for extraído
# para um serviço separado, o publish() passa a serializar para uma fila real (SQS) —
# os handlers e o formato do evento não mudam.


@dataclass(frozen=True)
class DomainEvent:
    name: str
    payload: dict[str, Any]


class EventBus:
    def __init__(self) -> None:
        self._handlers: dict[str, list[Callable[[DomainEvent], None]]] = defaultdict(list)

    def subscribe(self, event_name: str, handler: Callable[[DomainEvent], None]) -> None:
        self._handlers[event_name].append(handler)

    def publish(self, event: DomainEvent) -> None:
        for handler in self._handlers.get(event.name, []):
            handler(event)


event_bus = EventBus()
