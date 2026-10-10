// Junta motor de cálculo + projeção + alertas para um cliente/cenário.

import { daysBetween, isValidDate, isValidMonth } from '../lib/dates';
import { money, pct } from '../lib/format';
import { computePlan, nn, type LineResult, type PlanResult } from './calc';
import { projectSavings, type ProjectionResult } from './savings';
import type { Client, Scenario, Settings } from './types';

export type AlertSeverity = 'critico' | 'atencao' | 'info';

export interface PlanAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
}

export interface Analysis {
  scenario: Scenario;
  plan: PlanResult;
  projection: ProjectionResult;
  alerts: PlanAlert[];
}

export function selectedScenario(client: Client): Scenario {
  return client.scenarios.find((s) => s.id === client.selectedScenarioId) ?? client.scenarios[0];
}

export function projectionFor(client: Client, scenario: Scenario, plan: PlanResult): ProjectionResult {
  return projectSavings({
    startBalance: plan.main.available.totalBRL,
    goalToday: plan.main.required.totalBRL,
    baseSavings: Number(client.finances.savingsCapacityBRL) || 0,
    plan: client.savingsPlan,
    costIncreasePctYear: scenario.costIncreasePctYear,
    targetMonth: client.move.targetMonth,
  });
}

/** Linhas que ainda não têm uma cotação rastreável (fonte + data) ou estão marcadas sem cotação. */
export function unquotedLines(plan: PlanResult): LineResult[] {
  return [...plan.oneTimeLines, ...plan.monthlyLines].filter(
    (l) => l.id !== 'brazil_ongoing' && l.subtotal > 0 && (l.status === 'sem_cotacao' || !l.source.trim() || !isValidDate(l.consultedAt)),
  );
}

export function staleLines(plan: PlanResult, settings: Settings, today: string): LineResult[] {
  return [...plan.oneTimeLines, ...plan.monthlyLines].filter((l) => {
    const d = daysBetween(l.consultedAt, today);
    return d !== null && d > settings.priceStaleDays;
  });
}

export function analyze(client: Client, settings: Settings, today: string, scenarioArg?: Scenario): Analysis {
  const scenario = scenarioArg ?? selectedScenario(client);
  const plan = computePlan(client, scenario);
  const projection = projectionFor(client, scenario, plan);
  return { scenario, plan, projection, alerts: buildAlerts(client, scenario, plan, projection, settings, today) };
}

export function buildAlerts(
  client: Client,
  scenario: Scenario,
  plan: PlanResult,
  proj: ProjectionResult,
  settings: Settings,
  today: string,
): PlanAlert[] {
  const alerts: PlanAlert[] = [];
  const push = (id: string, severity: AlertSeverity, title: string, detail: string) =>
    alerts.push({ id, severity, title, detail });

  for (const b of plan.blockers) push(`blocker_${alerts.length}`, 'critico', 'Cálculo incompleto', b);

  const f = client.finances;
  const main = plan.main;
  const savings = Number(f.savingsCapacityBRL) || 0;

  // Reserva / meta
  if (main.shortfallBRL > 0) {
    push(
      'reserva_insuficiente',
      'atencao',
      'Reserva insuficiente',
      `Os recursos destinados à mudança cobrem ${pct(main.progressPct)} da meta. Faltam ${money(main.shortfallBRL)}.`,
    );
  }
  if (main.shortfallBRL > 0 && savings <= 0) {
    push(
      'meta_inatingivel',
      'critico',
      'Meta não atingível com o plano atual',
      'A poupança mensal é zero ou negativa. Sem mudança no plano, não há data para atingir a meta. Alternativas: reduzir custos (cenário econômico, moradia compartilhada), adiar a data, aumentar renda, renegociar parcelas ou planejar aportes extraordinários.',
    );
  } else if (proj.unreachable && main.shortfallBRL > 0) {
    push(
      'meta_inatingivel',
      'critico',
      'Meta não atingível com o plano atual',
      'Com a poupança planejada, a meta não é alcançada (os custos sobem mais rápido do que a poupança ou há retiradas). Revise premissas ou a poupança mensal.',
    );
  }

  // Poupança x data
  if (proj.monthsUntilMove !== null && proj.monthsUntilMove <= 0 && main.shortfallBRL > 0) {
    push(
      'data_sem_prazo',
      'critico',
      'Data pretendida sem tempo de poupança',
      'A data pretendida para a mudança é igual ou anterior ao início da poupança, e ainda há valor faltante.',
    );
  }
  if (proj.requiredMonthlyToMove !== null && proj.requiredMonthlyToMove > 0 && savings < proj.requiredMonthlyToMove) {
    push(
      'poupanca_incompativel',
      'critico',
      'Poupança mensal incompatível com a data pretendida',
      `Para chegar à meta na data pretendida seria preciso poupar ${money(proj.requiredMonthlyToMove)}/mês; a capacidade informada é ${money(savings)}/mês.`,
    );
  }

  // Consistência dos dados declarados
  const computedCapacity = nn(f.monthlyIncomeBRL) - nn(f.monthlyExpensesBRL) - nn(f.monthlyDebtBRL);
  if (nn(f.monthlyIncomeBRL) > 0 && savings > computedCapacity + 1) {
    push(
      'poupanca_inconsistente',
      'atencao',
      'Capacidade de poupança acima do que sobra no orçamento',
      `Renda − despesas − parcelas = ${money(computedCapacity)}, mas a poupança declarada é ${money(savings)}. Confirme os números com o cliente.`,
    );
  }

  // Cotações
  const unquoted = unquotedLines(plan);
  if (unquoted.length > 0) {
    push(
      'sem_cotacao',
      'atencao',
      `${unquoted.length} custo(s) ainda sem cotação`,
      `Itens sem fonte e data de consulta, ou marcados como "sem cotação": ${unquoted
        .slice(0, 6)
        .map((l) => l.name)
        .join(', ')}${unquoted.length > 6 ? '…' : ''}. Os valores são estimativas de partida, não cotações atuais.`,
    );
  }
  const stale = staleLines(plan, settings, today);
  if (stale.length > 0) {
    push(
      'precos_antigos',
      'info',
      `${stale.length} preço(s) consultado(s) há mais de ${settings.priceStaleDays} dias`,
      `Revise: ${stale.slice(0, 6).map((l) => l.name).join(', ')}${stale.length > 6 ? '…' : ''}.`,
    );
  }

  // Câmbio
  const fxAge = daysBetween(scenario.fx.quotedAt, today);
  if (plan.rates.rate > 0 && (fxAge === null || fxAge > settings.fxStaleDays)) {
    push(
      'cambio_desatualizado',
      'atencao',
      'Câmbio desatualizado',
      fxAge === null
        ? 'O câmbio do cenário não tem data de consulta. Atualize antes de apresentar ao cliente.'
        : `O câmbio foi consultado há ${fxAge} dias (limite configurado: ${settings.fxStaleDays}). Cada R$ 0,10 de alta no euro muda a meta em cerca de ${money(plan.fxImpactPer10Cents)}.`,
    );
  }
  if (plan.rates.rate > 0 && nn(scenario.fx.conversionCostPct) === 0) {
    push(
      'conversao_zero',
      'info',
      'Custo de conversão não considerado',
      'O custo de conversão (spread, IOF e tarifas) está em 0%. Confirme a alíquota e as tarifas vigentes no meio de remessa que o cliente usará.',
    );
  }

  // Renda futura
  if (plan.incomeIncluded && !scenario.income.confirmed) {
    push(
      'renda_nao_confirmada',
      'critico',
      'Meta depende de renda futura não confirmada',
      `A meta deste cenário desconta ${money(plan.withIncome.incomeOffset.totalBRL)} de renda que ainda não está confirmada. Sem essa renda, a meta seria ${money(plan.withoutIncome.required.totalBRL)}.`,
    );
  }
  if (plan.incomeIncluded && plan.incomeShare * 100 > settings.incomeDependencyLimitPct) {
    push(
      'dependencia_renda',
      'atencao',
      'Dependência excessiva de renda futura',
      `${pct(plan.incomeShare * 100)} do custo de vida financiado está coberto por renda futura (limite configurado: ${pct(settings.incomeDependencyLimitPct)}).`,
    );
  }

  // Margem
  if (nn(scenario.contingencyPct) === 0 && main.emergency.totalBRL === 0) {
    push(
      'sem_margem',
      'critico',
      'Sem margem para imprevistos',
      'O cenário não tem margem de imprevistos nem reserva de emergência. Qualquer custo acima do previsto compromete o plano.',
    );
  } else if (main.emergency.totalBRL > 0 && main.emergency.totalBRL < plan.monthlyLiving.totalBRL) {
    push(
      'emergencia_baixa',
      'atencao',
      'Reserva de emergência menor que 1 mês de custo de vida',
      `Reserva: ${money(main.emergency.totalBRL)}; custo de vida mensal: ${money(plan.monthlyLiving.totalBRL)}.`,
    );
  }

  // Moradia
  if (plan.household.children > 0 && scenario.housing.type === 'quarto_compartilhado') {
    push(
      'moradia_incompativel',
      'atencao',
      'Tipo de moradia pouco compatível com a família',
      'O cenário usa quarto compartilhado para uma família com crianças. Verifique se é viável e aceito por proprietários.',
    );
  }
  if (plan.rentAdvance.excess > 0) {
    push(
      'aluguel_antecipado',
      'info',
      'Aluguel antecipado além do período financiado',
      `${plan.rentAdvance.excess} mês(es) de aluguel antecipado ultrapassam o período financiado e foram somados como custo inicial.`,
    );
  }

  // Data
  if (
    proj.reachedMonth &&
    proj.monthsToGoal !== null &&
    proj.monthsToGoal > 0 &&
    isValidMonth(client.move.targetMonth) &&
    proj.reachedMonth > client.move.targetMonth
  ) {
    push(
      'data_anterior_meta',
      'atencao',
      'Data pretendida anterior à data projetada da meta',
      'Com a poupança atual, a meta é atingida depois da data pretendida para a mudança.',
    );
  }

  // Depósitos
  if (main.deposits.totalBRL > 0) {
    push(
      'depositos',
      'info',
      'Depósitos precisam ser financiados no início',
      `${money(main.deposits.totalBRL)} são cauções potencialmente reembolsáveis. Contam na meta porque saem do bolso na chegada, mas não são gasto definitivo.`,
    );
  }

  if (main.shortfallBRL === 0 && plan.valid) {
    push(
      'meta_matematica',
      'info',
      'Meta atingida matematicamente — isso não garante um plano seguro',
      'Os recursos cobrem a meta calculada, mas a segurança depende da qualidade das cotações, do câmbio, da obtenção de renda e de requisitos oficiais que precisam ser verificados individualmente.',
    );
  }

  const order: Record<AlertSeverity, number> = { critico: 0, atencao: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

export interface ScenarioComparison {
  scenario: Scenario;
  plan: PlanResult;
  projection: ProjectionResult;
}

export function compareScenarios(client: Client): ScenarioComparison[] {
  return client.scenarios.map((scenario) => {
    const plan = computePlan(client, scenario);
    return { scenario, plan, projection: projectionFor(client, scenario, plan) };
  });
}
