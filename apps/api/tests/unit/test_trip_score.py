import pytest

from modules.recommendations.application.ports import PriceHistoryReader
from modules.recommendations.application.trip_score import CalculateTripScore, NoPriceDataError
from modules.recommendations.domain.entities import HistoricalPricePoint, MileageValuation
from modules.recommendations.infrastructure.repository import (
    InMemoryMileageValuationReader,
    InMemoryRecommendationRepository,
    StaticExchangeSignalReader,
)


class FixedHistoryReader(PriceHistoryReader):
    def __init__(self, points: list[HistoricalPricePoint]) -> None:
        self._points = points

    def history(self, origin_iata, destination_iata, cabin_class, range_days):
        return self._points


def _points(prices: list[int]) -> list[HistoricalPricePoint]:
    # Timestamps ISO crescentes — o último preço da lista é o "mais recente".
    return [
        HistoricalPricePoint(price_cents=price, collected_at=f"2026-01-{i + 1:02d}T00:00:00")
        for i, price in enumerate(prices)
    ]


def _use_case(history_points, mileage=None, currency="unknown", recommendations=None):
    return CalculateTripScore(
        FixedHistoryReader(history_points),
        InMemoryMileageValuationReader(mileage or []),
        StaticExchangeSignalReader(currency),
        recommendations or InMemoryRecommendationRepository(),
    )


def test_raises_when_no_price_history_exists():
    use_case = _use_case([])
    with pytest.raises(NoPriceDataError):
        use_case.execute("FLN", "MAD", "economy")


def test_insufficient_data_verdict_with_too_few_samples():
    use_case = _use_case(_points([300_000, 310_000]))
    result = use_case.execute("FLN", "MAD", "economy")

    assert result.verdict == "insufficient_data"
    assert result.confidence == 0.3


def test_buy_verdict_when_price_is_near_historical_minimum():
    # 7 amostras, preço atual (último) é o único mínimo -> hit_rate = 1/7 ≈ 0.14 <= 0.15 -> "buy"
    history = _points([400_000, 390_000, 420_000, 410_000, 405_000, 415_000, 300_000])
    result = _use_case(history).execute("FLN", "MAD", "economy")

    assert result.verdict == "buy"
    assert result.confidence >= 0.6
    assert result.factors["hit_rate"] <= 0.15
    assert "comprar agora" in result.explanation.lower()


def test_wait_verdict_when_price_trending_down():
    # Metade mais antiga em R$4000, metade mais recente (incluindo o preço atual) em
    # R$3000: tendência de queda clara, mas o preço atual empata com outras 4 amostras
    # recentes -> hit_rate alto (não é um mínimo raro) -> cai no ramo "trend == down".
    history = _points([400_000] * 5 + [300_000] * 5)
    result = _use_case(history).execute("FLN", "MAD", "economy")

    assert result.verdict == "wait"
    assert result.factors["trend_7d"] == "down"
    assert result.factors["hit_rate"] > 0.15


def test_recommendation_is_persisted():
    repo = InMemoryRecommendationRepository()
    use_case = _use_case(_points([300_000, 305_000, 295_000, 310_000]), recommendations=repo)

    use_case.execute("FLN", "MAD", "economy")

    assert len(repo.saved) == 1


def test_mileage_comparison_included_in_factors():
    history = _points([300_000, 305_000, 295_000, 310_000])
    mileage = [MileageValuation("SMILES", "Smiles (GOL)", 2.0)]
    result = _use_case(history, mileage=mileage).execute("FLN", "MAD", "economy")

    comparisons = result.factors["mileage_comparison"]
    assert len(comparisons) == 1
    assert comparisons[0]["program"] == "SMILES"
    assert comparisons[0]["estimated_miles"] == round(result.current_price_cents / 2.0)


def test_favorable_currency_signal_is_mentioned_in_explanation():
    history = _points([300_000, 305_000, 295_000, 310_000])
    result = _use_case(history, currency="favorable").execute("FLN", "MAD", "economy")

    assert "câmbio" in result.explanation.lower()
    assert result.factors["currency_signal"] == "favorable"
