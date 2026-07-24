from abc import ABC, abstractmethod

from modules.providers.domain.entities import FlightOffer


class FlightSearchProvider(ABC):
    """Porta única para qualquer fornecedor de busca de voo (Amadeus, Duffel, Kiwi, mock...).

    `price_monitoring` e `recommendations` dependem apenas desta interface, nunca de um
    provedor concreto — trocar ou adicionar um fornecedor é implementar esta classe, sem
    tocar em nenhum outro módulo (ver docs/03-arquitetura.md, seção 4.1).
    """

    @abstractmethod
    def search(
        self,
        *,
        origin_iata: str,
        destination_iata: str,
        departure_date: str,
        return_date: str | None,
        cabin_class: str,
        passengers: int,
    ) -> list[FlightOffer]: ...
