from modules.recommendations.domain.entities import MileageComparison, MileageValuation


def compare_cash_vs_miles(price_cents: int, valuations: list[MileageValuation]) -> list[MileageComparison]:
    """Estimativa de referência (não uma tabela de resgate real por trecho): quantas
    milhas de cada programa "equivaleriam" ao preço à vista, usando um valor de
    referência de cents-per-mile curado manualmente (ver docs/04-modelo-dados.md,
    seção 5.2). Evolui para integração dinâmica por programa se a Fase Beta validar
    que os usuários usam essa informação para decidir."""
    comparisons = []
    for valuation in valuations:
        if valuation.reference_cents_per_mile <= 0:
            continue
        miles_needed = round(price_cents / valuation.reference_cents_per_mile)
        comparisons.append(
            MileageComparison(
                program_code=valuation.program_code,
                program_name=valuation.program_name,
                estimated_miles_needed=miles_needed,
            )
        )
    return comparisons
