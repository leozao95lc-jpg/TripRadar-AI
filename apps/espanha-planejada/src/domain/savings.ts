// Projeção de poupança mês a mês. Não presume rendimento de investimentos:
// o saldo só cresce com o que o cliente efetivamente poupa e aporta.

import { round2 } from '../lib/format';
import { addMonths, diffMonths, isValidMonth } from '../lib/dates';
import { nn } from './calc';
import type { CashEvent, SavingsPlan } from './types';

export const HORIZON = 36;
/** Limite de busca além do horizonte exibido (50 anos). */
const SEARCH_LIMIT = 600;

export interface ProjectionRow {
  index: number;
  month: string;
  opening: number;
  savings: number;
  contributions: number;
  extraExpenses: number;
  closing: number;
  goal: number;
  gap: number;
}

export interface ProjectionResult {
  rows: ProjectionRow[];
  startBalance: number;
  goalToday: number;
  /** Meses de poupança até atingir a meta. 0 = já atingida. null = não atingível. */
  monthsToGoal: number | null;
  /** Mês (fim) em que a meta é atingida. */
  reachedMonth: string | null;
  beyondHorizon: boolean;
  unreachable: boolean;
  /** Meses de poupança disponíveis até a data pretendida. */
  monthsUntilMove: number | null;
  goalAtMove: number | null;
  /** Poupança mensal necessária para chegar à meta na data pretendida. */
  requiredMonthlyToMove: number | null;
  baseSavings: number;
}

export interface ProjectionInput {
  startBalance: number;
  goalToday: number;
  baseSavings: number;
  plan: SavingsPlan;
  costIncreasePctYear: number;
  targetMonth: string;
  horizon?: number;
}

/** Poupança planejada para o mês `index`, respeitando os períodos personalizados. */
export function savingsFor(index: number, base: number, plan: SavingsPlan): number {
  // O último período cadastrado que cobre o mês prevalece.
  let amount = base;
  for (const p of plan.periods) {
    if (index >= p.fromMonth && index <= p.toMonth) amount = Number.isFinite(p.amount) ? p.amount : 0;
  }
  return amount;
}

function sumAt(events: CashEvent[], index: number): number {
  return events.filter((e) => e.month === index).reduce((s, e) => s + nn(e.amount), 0);
}

function sumUpTo(events: CashEvent[], index: number): number {
  return events.filter((e) => e.month >= 1 && e.month <= index).reduce((s, e) => s + nn(e.amount), 0);
}

export function goalAt(goalToday: number, pctYear: number, monthIndex: number): number {
  const g = nn(pctYear) / 100;
  return goalToday * Math.pow(1 + g, monthIndex / 12);
}

export function projectSavings(input: ProjectionInput): ProjectionResult {
  const horizon = input.horizon ?? HORIZON;
  const { plan } = input;
  // A poupança base pode ser negativa (cliente gastando reserva); isso é tratado como dado real.
  const base = Number.isFinite(input.baseSavings) ? input.baseSavings : 0;
  const start = isValidMonth(plan.startMonth) ? plan.startMonth : null;

  const rows: ProjectionRow[] = [];
  let balance = input.startBalance;
  let monthsToGoal: number | null = balance >= input.goalToday ? 0 : null;

  for (let i = 1; i <= SEARCH_LIMIT; i++) {
    const savings = savingsFor(i, base, plan);
    const contributions = sumAt(plan.contributions, i);
    const extraExpenses = sumAt(plan.extraExpenses, i);
    const opening = balance;
    balance = opening + savings + contributions - extraExpenses;
    const goal = goalAt(input.goalToday, input.costIncreasePctYear, i);
    if (i <= horizon) {
      rows.push({
        index: i,
        month: start ? addMonths(start, i - 1) : '',
        opening: round2(opening),
        savings: round2(savings),
        contributions: round2(contributions),
        extraExpenses: round2(extraExpenses),
        closing: round2(balance),
        goal: round2(goal),
        gap: round2(balance - goal),
      });
    }
    if (monthsToGoal === null && balance >= goal) monthsToGoal = i;
    if (monthsToGoal !== null && i >= horizon) break;
    // Sem eventos futuros e sem poupança positiva, a meta nunca será atingida: para cedo.
    const futureEvents = plan.contributions.some((e) => e.month > i) || plan.periods.some((p) => p.toMonth > i);
    if (monthsToGoal === null && i >= horizon && base <= 0 && !futureEvents) break;
  }

  let monthsUntilMove: number | null = null;
  let goalAtMove: number | null = null;
  let requiredMonthlyToMove: number | null = null;
  if (start && isValidMonth(input.targetMonth)) {
    monthsUntilMove = diffMonths(start, input.targetMonth);
    if (monthsUntilMove > 0) {
      goalAtMove = round2(goalAt(input.goalToday, input.costIncreasePctYear, monthsUntilMove));
      const needed =
        goalAtMove -
        input.startBalance -
        sumUpTo(plan.contributions, monthsUntilMove) +
        sumUpTo(plan.extraExpenses, monthsUntilMove);
      requiredMonthlyToMove = round2(Math.max(0, needed / monthsUntilMove));
    }
  }

  const reachedMonth =
    monthsToGoal === null || !start ? null : monthsToGoal === 0 ? addMonths(start, -1) : addMonths(start, monthsToGoal - 1);

  return {
    rows,
    startBalance: round2(input.startBalance),
    goalToday: round2(input.goalToday),
    monthsToGoal,
    reachedMonth,
    beyondHorizon: monthsToGoal !== null && monthsToGoal > horizon,
    unreachable: monthsToGoal === null,
    monthsUntilMove,
    goalAtMove,
    requiredMonthlyToMove,
    baseSavings: base,
  };
}
