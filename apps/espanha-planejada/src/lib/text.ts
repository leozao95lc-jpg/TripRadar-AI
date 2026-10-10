// Textos gerados a partir dos números (resumo executivo, descrição da projeção).

import type { Analysis } from '../domain/analysis';
import { HOUSING_LABELS, PROFILE_LABELS } from '../domain/labels';
import type { ProjectionResult } from '../domain/savings';
import type { Client } from '../domain/types';
import { monthLabel } from './dates';
import { money, pct } from './format';

export function monthsToGoalText(p: ProjectionResult): string {
  if (p.monthsToGoal === 0) return 'Meta já coberta';
  if (p.monthsToGoal === null) return 'Não atingível';
  return `${p.monthsToGoal} ${p.monthsToGoal === 1 ? 'mês' : 'meses'}${p.beyondHorizon ? ' (além de 36)' : ''}`;
}

export function reachedText(p: ProjectionResult): string {
  if (p.monthsToGoal === 0) return 'Hoje';
  if (p.monthsToGoal === null || !p.reachedMonth) return 'Sem data com o plano atual';
  return monthLabel(p.reachedMonth);
}

export function requiredMonthlyText(p: ProjectionResult): string {
  if (p.monthsUntilMove === null) return '—';
  if (p.monthsUntilMove <= 0) return 'Data pretendida já chegou';
  return `${money(p.requiredMonthlyToMove ?? 0)}/mês`;
}

export function executiveSummary(client: Client, a: Analysis): string {
  const { plan, projection: p, scenario } = a;
  const m = plan.main;
  const name = client.personal.name || 'Cliente';
  const h = plan.household;
  const lines: string[] = [];
  lines.push(`Resumo executivo — ${name}`);
  lines.push('');
  lines.push(
    `Perfil: ${PROFILE_LABELS[client.profile]} (${h.adults} adulto(s), ${h.children} criança(s)${h.pets ? `, ${h.pets} animal(is)` : ''}). ` +
      `Destino: ${client.move.targetCity || 'a definir'}, mudança pretendida em ${monthLabel(client.move.targetMonth)}. ` +
      `Cenário analisado: ${scenario.name} — ${HOUSING_LABELS[scenario.housing.type].toLowerCase()}.`,
  );
  if (!plan.valid) {
    lines.push('');
    lines.push(`Cálculo incompleto: ${plan.blockers.join(' ')}`);
    return lines.join('\n');
  }
  lines.push('');
  lines.push(
    `Meta total de recursos: ${money(m.required.totalBRL)}. Ela se divide em ${money(m.oneTimeDefinitive.totalBRL)} de custos únicos definitivos, ` +
      `${money(m.deposits.totalBRL)} de depósitos potencialmente reembolsáveis, ${money(m.runwayNet.totalBRL)} para financiar ${plan.runwayMonths} meses de custo de vida, ` +
      `${money(m.contingency.totalBRL)} de margem para imprevistos e ${money(m.emergency.totalBRL)} de reserva de emergência.`,
  );
  lines.push(
    `Custo de vida estimado na Espanha: ${money(plan.monthlyLiving.totalBRL)} por mês (${money(plan.monthlyLiving.eur, 'EUR')} em euros + ${money(plan.monthlyLiving.brl)} em reais).`,
  );
  lines.push(
    `Recursos destinados à mudança hoje: ${money(m.available.totalBRL)} (${pct(m.progressPct)} da meta). ` +
      (m.shortfallBRL > 0 ? `Faltam ${money(m.shortfallBRL)}.` : `A meta calculada está coberta, com ${money(m.surplusBRL)} acima dela.`),
  );
  if (m.shortfallBRL > 0) {
    if (p.monthsToGoal === null) {
      lines.push('Com a poupança mensal atual, a meta não é atingível. É necessário rever custos, prazo, renda ou aportes antes de definir uma data.');
    } else {
      lines.push(
        `Poupando ${money(p.baseSavings)} por mês, a meta é atingida em ${monthsToGoalText(p).toLowerCase()} (${reachedText(p)}).` +
          (p.requiredMonthlyToMove !== null && p.monthsUntilMove !== null && p.monthsUntilMove > 0
            ? ` Para manter a data pretendida, seria preciso poupar ${money(p.requiredMonthlyToMove)} por mês.`
            : ''),
      );
    }
  }
  lines.push(
    `Câmbio considerado: R$ ${plan.rates.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por euro, com ${pct(scenario.fx.conversionCostPct, 1)} de custo de conversão. ` +
      `Cada R$ 0,10 de alta no euro aumenta a meta em cerca de ${money(plan.fxImpactPer10Cents)}.`,
  );
  if (plan.incomeIncluded) {
    lines.push(
      `A meta considera ${money(m.incomeOffset.totalBRL)} de renda futura (${scenario.income.confirmed ? 'confirmada' : 'NÃO confirmada'}). Sem ela, a meta seria ${money(plan.withoutIncome.required.totalBRL)}.`,
    );
  }
  const critical = a.alerts.filter((x) => x.severity !== 'info');
  if (critical.length) {
    lines.push('');
    lines.push('Pontos de atenção:');
    for (const al of critical) lines.push(`• ${al.title}`);
  }
  lines.push('');
  lines.push(
    'Atingir a meta matemática não garante um plano seguro. Valores são estimativas baseadas nas fontes indicadas; requisitos migratórios devem ser verificados em fonte oficial.',
  );
  return lines.join('\n');
}
