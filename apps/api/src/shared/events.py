from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

# Event bus em processo: módulos se comunicam publicando/assinando eventos de domínio,
# sem se importarem diretamente (ver src/bootstrap.py). Um caso de uso NUNCA publica
# direto no bus — ele só acumula em `self.pending_events`; é o composition root (rota
# HTTP, worker) que chama `event_bus.dispatch(pending_events, session)` depois de ter
# a sessão de banco em mãos. Handlers recebem essa MESMA sessão (nunca abrem a própria)
# e podem devolver novos eventos, que entram na mesma fila — dá pra encadear
# price_snapshot_collected -> alert_triggered -> notificação numa única transação, sem
# contextvars/threadlocals e sem duas conexões disputando a mesma transação aberta.
#
# Quando um módulo for extraído para um serviço separado (ver docs/03-arquitetura.md),
# `dispatch` vira "publicar numa fila real (SQS)" e os handlers passam a rodar em outro
# processo, cada um com sua própria transação — a assinatura dos eventos não muda.


@dataclass(frozen=True)
class DomainEvent:
    name: str
    payload: dict[str, Any]


EventHandler = Callable[[DomainEvent, Any], "list[DomainEvent] | None"]


class EventBus:
    def __init__(self) -> None:
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)

    def subscribe(self, event_name: str, handler: EventHandler) -> None:
        self._handlers[event_name].append(handler)

    def dispatch(self, events: list[DomainEvent], session: Any) -> None:
        queue = list(events)
        while queue:
            event = queue.pop(0)
            for handler in self._handlers.get(event.name, []):
                new_events = handler(event, session)
                if new_events:
                    queue.extend(new_events)


event_bus = EventBus()
