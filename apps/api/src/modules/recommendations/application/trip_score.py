from statistics import mean

from modules.recommendations.application.mileage_advisor import compare_cash_vs_miles
from modules.recommendations.application.ports import (
    ExchangeSignalReader,
    MileageValuationReader,
    PriceHistoryReader,
    RecommendationRepository,
)
from modules.recommendations.domain.entities import HistoricalPricePoint, TripScoreResult

MIN_SAMPLE_SIZE = 3


class NoPriceDataError(Exception):
    pass


class CalculateTripScore:
    """TripScore: heurística baseada em regras (sem ML) sobre o histórico de preço da
    própria rota — comparação com mínimo/média histórica e tendência recente — mais os
    dois sinais de diferenciação da revisão estratégica (milhas e câmbio). Cada
    veredito vem com os fatores que o embasaram, nunca uma resposta caixa-preta (ver
    docs/01-analise-e-riscos.md e docs/08-revisao-estrategica-latam.md)."""

    def __init__(
        self,
        history_reader: PriceHistoryReader,
        mileage_reader: MileageValuationReader,
        exchange_reader: ExchangeSignalReader,
        recommendations: RecommendationRepository,
    ) -> None:
        self._history_reader = history_reader
        self._mileage_reader = mileage_reader
        self._exchange_reader = exchange_reader
        self._recommendations = recommendations

    def execute(
        self, origin_iata: str, destination_iata: str, cabin_class: str, range_days: int = 90
    ) -> TripScoreResult:
        history = self._history_reader.history(origin_iata, destination_iata, cabin_class, range_days)
        if not history:
            raise NoPriceDataError(f"{origin_iata}-{destination_iata}")

        prices = [point.price_cents for point in history]
        current_price = self._most_recent(history).price_cents
        avg_price = mean(prices)
        min_price = min(prices)
        hit_rate = sum(1 for p in prices if p <= current_price) / len(prices)
        below_avg_pct = (avg_price - current_price) / avg_price * 100 if avg_price else 0.0
        trend_7d = self._trend(history)

        verdict, confidence, explanation = self._decide(hit_rate, below_avg_pct, trend_7d, len(history))

        mileage_comparisons = compare_cash_vs_miles(current_price, self._mileage_reader.list_all())
        currency_signal = self._exchange_reader.latest_signal()
        explanation = self._augment_explanation(explanation, currency_signal)

        result = TripScoreResult(
            origin_iata=origin_iata,
            destination_iata=destination_iata,
            cabin_class=cabin_class,
            verdict=verdict,
            confidence=confidence,
            current_price_cents=current_price,
            target_price_cents=min_price,
            explanation=explanation,
            factors={
                "hit_rate": round(hit_rate, 3),
                "below_avg_pct": round(below_avg_pct, 1),
                "trend_7d": trend_7d,
                "sample_size": len(history),
                "mileage_comparison": [
                    {"program": c.program_code, "estimated_miles": c.estimated_miles_needed}
                    for c in mileage_comparisons
                ],
                "currency_signal": currency_signal,
            },
        )
        self._recommendations.add(result)
        return result

    @staticmethod
    def _most_recent(history: list[HistoricalPricePoint]) -> HistoricalPricePoint:
        return max(history, key=lambda p: p.collected_at)

    @staticmethod
    def _trend(history: list[HistoricalPricePoint]) -> str:
        ordered = sorted(history, key=lambda p: p.collected_at)
        if len(ordered) < 4:
            return "stable"
        midpoint = len(ordered) // 2
        older = mean(p.price_cents for p in ordered[:midpoint])
        recent = mean(p.price_cents for p in ordered[midpoint:])
        if older == 0:
            return "stable"
        delta_pct = (recent - older) / older * 100
        if delta_pct <= -3:
            return "down"
        if delta_pct >= 3:
            return "up"
        return "stable"

    @staticmethod
    def _decide(
        hit_rate: float, below_avg_pct: float, trend_7d: str, sample_size: int
    ) -> tuple[str, float, str]:
        if sample_size < MIN_SAMPLE_SIZE:
            return (
                "insufficient_data",
                0.3,
                "Ainda não temos histórico suficiente desta rota para uma recomendação confiável.",
            )
        if hit_rate <= 0.15:
            confidence = round(min(0.95, 0.6 + (0.15 - hit_rate) * 2), 2)
            explanation = (
                f"Esse preço está entre os {hit_rate:.0%} mais baratos já vistos nesta rota. "
                "A chance de uma nova queda relevante é baixa. Recomendamos comprar agora."
            )
            return "buy", confidence, explanation
        if trend_7d == "down":
            return (
                "wait",
                0.6,
                "O preço vem caindo nos últimos dias (tendência de queda). Historicamente pode "
                "valer esperar mais um pouco antes de comprar.",
            )
        if below_avg_pct >= 5:
            return (
                "buy",
                0.7,
                f"O preço está {below_avg_pct:.0f}% abaixo da média histórica desta rota — "
                "uma boa oportunidade.",
            )
        return (
            "wait",
            0.55,
            "O preço está próximo da média histórica desta rota, sem sinal claro de queda iminente.",
        )

    @staticmethod
    def _augment_explanation(explanation: str, currency_signal: str) -> str:
        if currency_signal == "favorable":
            return f"{explanation} O câmbio também está favorável para essa rota internacional."
        if currency_signal == "unfavorable":
            return f"{explanation} Atenção: o câmbio está desfavorável no momento."
        return explanation
