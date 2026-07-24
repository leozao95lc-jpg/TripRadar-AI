from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.recommendations.application.ports import (
    ExchangeSignalReader,
    MileageValuationReader,
    RecommendationRepository,
)
from modules.recommendations.domain.entities import MileageValuation, TripScoreResult
from modules.recommendations.infrastructure.models import (
    AiRecommendationModel,
    ExchangeRateModel,
    MileageValuationModel,
)


class SqlAlchemyRecommendationRepository(RecommendationRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, result: TripScoreResult) -> None:
        self._session.add(
            AiRecommendationModel(
                id=str(result.id),
                origin_iata=result.origin_iata,
                destination_iata=result.destination_iata,
                cabin_class=result.cabin_class,
                verdict=result.verdict,
                confidence=result.confidence,
                current_price_cents=result.current_price_cents,
                target_price_cents=result.target_price_cents,
                explanation=result.explanation,
                factors=result.factors,
                generated_at=result.generated_at,
            )
        )
        self._session.flush()


class SqlAlchemyMileageValuationReader(MileageValuationReader):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_all(self) -> list[MileageValuation]:
        rows = self._session.execute(select(MileageValuationModel)).scalars().all()
        return [
            MileageValuation(
                program_code=r.program_code,
                program_name=r.program_name,
                reference_cents_per_mile=r.reference_cents_per_mile,
            )
            for r in rows
        ]


class SqlAlchemyExchangeSignalReader(ExchangeSignalReader):
    """Compara a taxa mais recente com a referência armazenada na mesma linha (ver
    nota em infrastructure/models.py sobre a ingestão diária real ainda não existir)."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def latest_signal(self) -> str:
        row = self._session.execute(
            select(ExchangeRateModel).order_by(ExchangeRateModel.collected_at.desc()).limit(1)
        ).scalar_one_or_none()
        if row is None or row.reference_rate <= 0:
            return "unknown"
        delta_pct = (row.rate - row.reference_rate) / row.reference_rate * 100
        if delta_pct <= -2:
            return "favorable"
        if delta_pct >= 2:
            return "unfavorable"
        return "stable"


class InMemoryRecommendationRepository(RecommendationRepository):
    def __init__(self) -> None:
        self.saved: list[TripScoreResult] = []

    def add(self, result: TripScoreResult) -> None:
        self.saved.append(result)


class InMemoryMileageValuationReader(MileageValuationReader):
    def __init__(self, valuations: list[MileageValuation] | None = None) -> None:
        self._valuations = valuations or []

    def list_all(self) -> list[MileageValuation]:
        return self._valuations


class StaticExchangeSignalReader(ExchangeSignalReader):
    def __init__(self, signal: str = "unknown") -> None:
        self._signal = signal

    def latest_signal(self) -> str:
        return self._signal
