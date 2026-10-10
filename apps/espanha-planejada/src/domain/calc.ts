// Motor de cálculo do Espanha Planejada.
//
// Princípios:
//  1. Toda soma é feita por moeda (EUR e BRL separados) e só convertida no fim.
//  2. Euros que o cliente já tem cobrem primeiro necessidades em euro (sem custo de conversão).
//  3. Necessidades em euro não cobertas são compradas com reais ao câmbio de compra
//     (câmbio × (1 + custo de conversão)). Euros excedentes valem câmbio de venda.
//  4. Custos já pagos não entram na meta nem nos recursos (evita contagem dupla).
//  5. Aluguel antecipado dentro do período financiado já está no custo de vida.
//  6. Renda futura só reduz a meta se o cenário mandar explicitamente.

import { round2 } from '../lib/format';
import { MONTHLY_CATEGORY_LABELS, ONE_TIME_CATEGORY_LABELS } from './labels';
import type {
  Client,
  CostItem,
  Currency,
  Finances,
  Household,
  MonthlyCategory,
  OneTimeCategory,
  OneTimeNature,
  PriceMeta,
  Scaling,
  Scenario,
} from './types';

export interface Money2 {
  eur: number;
  brl: number;
}

export interface MoneyTotal extends Money2 {
  /** Valor em reais ao câmbio de compra (o que custaria comprar os euros hoje). */
  totalBRL: number;
}

export interface Rates {
  rate: number;
  buyRate: number;
  sellRate: number;
}

export interface LineResult extends PriceMeta {
  id: string;
  name: string;
  categoryLabel: string;
  currency: Currency;
  unitValue: number;
  quantity: number;
  scaling: Scaling;
  effectiveQty: number;
  subtotal: number;
  subtotalBRL: number;
  nature?: OneTimeNature;
  alreadyPaid?: boolean;
  /** Linha calculada a partir das premissas de moradia (não editável diretamente). */
  derived?: boolean;
  formula?: string;
}

export interface RequirementBlock {
  oneTimeDefinitive: MoneyTotal;
  deposits: MoneyTotal;
  runwayGross: MoneyTotal;
  incomeOffset: MoneyTotal;
  runwayNet: MoneyTotal;
  contingency: MoneyTotal;
  emergency: MoneyTotal;
  required: MoneyTotal;
  available: AvailableBlock;
  shortfallBRL: number;
  surplusBRL: number;
  progressPct: number;
}

export interface AvailableBlock {
  /** Reais destinados à mudança, após excluir o valor preservado. */
  brl: number;
  /** Euros destinados à mudança, após excluir o valor preservado. */
  eur: number;
  grossBRL: number;
  grossEUR: number;
  preservedBRL: number;
  eurCovered: number;
  eurExcess: number;
  totalBRL: number;
}

export interface PlanResult {
  valid: boolean;
  blockers: string[];
  household: Household & { persons: number };
  rates: Rates;
  oneTimeLines: LineResult[];
  monthlyLines: LineResult[];
  alreadyPaidBRL: number;
  monthlyLiving: MoneyTotal;
  runwayMonths: number;
  incomeMonthsInRunway: number;
  /** Fração (0–1) do custo de vida financiado coberta por renda futura, se incluída. */
  incomeShare: number;
  rentAdvance: { months: number; inRunway: number; excess: number };
  /** Bloco usado como meta oficial do cenário. */
  main: RequirementBlock;
  withoutIncome: RequirementBlock;
  withIncome: RequirementBlock;
  incomeIncluded: boolean;
  /** Variação do valor faltante para cada R$ 0,10 de alta no euro. */
  fxImpactPer10Cents: number;
}

/** Converte qualquer entrada numérica em número finito não negativo. */
export function nn(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function householdOf(client: Pick<Client, 'personal'>): Household & { persons: number } {
  const adults = Math.floor(nn(client.personal.adults));
  const children = Math.floor(nn(client.personal.children));
  const pets = Math.floor(nn(client.personal.pets));
  return { adults, children, pets, persons: adults + children };
}

export function scalingMultiplier(scaling: Scaling, h: Household): number {
  switch (scaling) {
    case 'fixo':
      return 1;
    case 'por_adulto':
      return h.adults;
    case 'por_crianca':
      return h.children;
    case 'por_pessoa':
      return h.adults + h.children;
    case 'por_animal':
      return h.pets;
  }
}

export function ratesOf(scenario: Scenario): Rates {
  const rate = nn(scenario.fx.rate);
  const cost = Math.min(nn(scenario.fx.conversionCostPct), 100) / 100;
  return { rate, buyRate: rate * (1 + cost), sellRate: rate * (1 - cost) };
}

const zero = (): Money2 => ({ eur: 0, brl: 0 });

function add(a: Money2, b: Money2): Money2 {
  return { eur: a.eur + b.eur, brl: a.brl + b.brl };
}

function scale(a: Money2, k: number): Money2 {
  return { eur: a.eur * k, brl: a.brl * k };
}

function inCurrency(amount: number, currency: Currency): Money2 {
  return currency === 'EUR' ? { eur: amount, brl: 0 } : { eur: 0, brl: amount };
}

function total(m: Money2, r: Rates): MoneyTotal {
  return { eur: round2(m.eur), brl: round2(m.brl), totalBRL: round2(m.brl + m.eur * r.buyRate) };
}

function toBRL(amount: number, currency: Currency, r: Rates): number {
  return currency === 'EUR' ? amount * r.buyRate : amount;
}

function lineOf(
  item: CostItem,
  categoryLabel: string,
  h: Household,
  r: Rates,
): LineResult {
  const unit = nn(item.unitValue);
  const qty = nn(item.quantity);
  const mult = scalingMultiplier(item.scaling, h);
  const effectiveQty = qty * mult;
  const subtotal = round2(unit * effectiveQty);
  return {
    id: item.id,
    name: item.name,
    categoryLabel,
    currency: item.currency,
    unitValue: unit,
    quantity: qty,
    scaling: item.scaling,
    effectiveQty,
    subtotal,
    subtotalBRL: round2(toBRL(subtotal, item.currency, r)),
    source: item.source,
    consultedAt: item.consultedAt,
    status: item.status,
    note: item.note,
  };
}

/** Linhas de custo único, incluindo as derivadas da moradia. */
export function oneTimeLinesOf(scenario: Scenario, h: Household, r: Rates): LineResult[] {
  const lines: LineResult[] = scenario.oneTimeCosts.map((c) => ({
    ...lineOf(c, ONE_TIME_CATEGORY_LABELS[c.category as OneTimeCategory] ?? 'Outros', h, r),
    nature: c.nature,
    alreadyPaid: c.alreadyPaid,
  }));

  const hs = scenario.housing;
  const rent = nn(hs.monthlyRent);
  const meta: PriceMeta = { source: hs.source, consultedAt: hs.consultedAt, status: hs.status, note: '' };
  const derived = (id: string, name: string, months: number, nature: OneTimeNature, formula: string): LineResult => {
    const subtotal = round2(rent * months);
    return {
      ...meta,
      id,
      name,
      categoryLabel: 'Moradia',
      currency: hs.currency,
      unitValue: rent,
      quantity: months,
      scaling: 'fixo',
      effectiveQty: months,
      subtotal,
      subtotalBRL: round2(toBRL(subtotal, hs.currency, r)),
      nature,
      alreadyPaid: false,
      derived: true,
      formula,
    };
  };

  const depositMonths = nn(hs.depositMonths);
  if (depositMonths > 0) {
    lines.push(derived('housing_deposit', 'Caução / fiança do aluguel', depositMonths, 'reembolsavel', `aluguel × ${depositMonths} mês(es)`));
  }
  const feeMonths = nn(hs.agencyFeeMonths);
  if (feeMonths > 0) {
    lines.push(derived('housing_fee', 'Comissão / taxa de intermediação', feeMonths, 'definitivo', `aluguel × ${feeMonths} mês(es)`));
  }
  const advance = rentAdvanceOf(scenario);
  if (advance.excess > 0) {
    lines.push(
      derived(
        'housing_advance',
        'Aluguel antecipado além do período financiado',
        advance.excess,
        'definitivo',
        `${advance.months} mês(es) antecipados − ${advance.inRunway} já no custo de vida`,
      ),
    );
  }
  return lines;
}

export function rentAdvanceOf(scenario: Scenario): { months: number; inRunway: number; excess: number } {
  const months = Math.floor(nn(scenario.housing.advanceRentMonths));
  const runway = Math.floor(nn(scenario.runwayMonths));
  const inRunway = Math.min(months, runway);
  return { months, inRunway, excess: months - inRunway };
}

/** Linhas de custo mensal, incluindo o aluguel e os compromissos que continuam no Brasil. */
export function monthlyLinesOf(scenario: Scenario, finances: Finances, h: Household, r: Rates): LineResult[] {
  const hs = scenario.housing;
  const rent = nn(hs.monthlyRent);
  const rentLine: LineResult = {
    id: 'housing_rent',
    name: 'Aluguel',
    categoryLabel: 'Moradia',
    currency: hs.currency,
    unitValue: rent,
    quantity: 1,
    scaling: 'fixo',
    effectiveQty: 1,
    subtotal: round2(rent),
    subtotalBRL: round2(toBRL(rent, hs.currency, r)),
    source: hs.source,
    consultedAt: hs.consultedAt,
    status: hs.status,
    note: '',
    derived: true,
    formula: 'premissa de moradia',
  };
  const lines = [
    rentLine,
    ...scenario.monthlyCosts.map((c) => lineOf(c, MONTHLY_CATEGORY_LABELS[c.category as MonthlyCategory] ?? 'Outros', h, r)),
  ];
  const ongoing = nn(finances.ongoingBrazilMonthlyBRL);
  if (ongoing > 0) {
    lines.push({
      id: 'brazil_ongoing',
      name: 'Compromissos que continuam no Brasil',
      categoryLabel: MONTHLY_CATEGORY_LABELS.compromissos_brasil,
      currency: 'BRL',
      unitValue: ongoing,
      quantity: 1,
      scaling: 'fixo',
      effectiveQty: 1,
      subtotal: round2(ongoing),
      subtotalBRL: round2(ongoing),
      source: 'Informado pelo cliente',
      consultedAt: '',
      status: 'confirmado',
      note: 'Parcelas e apoio a dependentes que seguem após a mudança.',
      derived: true,
      formula: 'dado financeiro do cliente',
    });
  }
  return lines;
}

function sumLines(lines: LineResult[]): Money2 {
  return lines.reduce<Money2>((acc, l) => add(acc, inCurrency(l.subtotal, l.currency)), zero());
}

/** Distribui a renda futura sobre o custo de vida financiado, sem nunca deixá-lo negativo. */
function applyIncome(gross: Money2, scenario: Scenario, runway: number, r: Rates): { offset: Money2; months: number } {
  const inc = scenario.income;
  const amount = nn(inc.monthlyAmount);
  const start = Math.max(1, Math.floor(nn(inc.startMonth)) || 1);
  const months = Math.max(0, runway - start + 1);
  const offsetAmount = amount * months;
  if (offsetAmount <= 0) return { offset: zero(), months };

  let useEur = 0;
  let useBrl = 0;
  if (inc.currency === 'EUR') {
    useEur = Math.min(offsetAmount, gross.eur);
    const leftEur = offsetAmount - useEur;
    useBrl = Math.min(leftEur * r.sellRate, gross.brl);
  } else {
    useBrl = Math.min(offsetAmount, gross.brl);
    const leftBrl = offsetAmount - useBrl;
    useEur = r.buyRate > 0 ? Math.min(leftBrl / r.buyRate, gross.eur) : 0;
  }
  return { offset: { eur: useEur, brl: useBrl }, months };
}

function availableOf(finances: Finances, requiredEur: number, r: Rates): AvailableBlock {
  const grossBRL = nn(finances.reserveBRL) + nn(finances.otherResourcesBRL);
  const grossEUR = nn(finances.reserveEUR);
  const preserved = nn(finances.preservedBRL);
  const brl = Math.max(0, grossBRL - preserved);
  const overflowBRL = Math.max(0, preserved - grossBRL);
  const eurToPreserve = r.sellRate > 0 ? overflowBRL / r.sellRate : 0;
  const eur = Math.max(0, grossEUR - eurToPreserve);
  const eurCovered = Math.min(eur, requiredEur);
  const eurExcess = eur - eurCovered;
  return {
    brl: round2(brl),
    eur: round2(eur),
    grossBRL: round2(grossBRL),
    grossEUR: round2(grossEUR),
    preservedBRL: round2(preserved),
    eurCovered: round2(eurCovered),
    eurExcess: round2(eurExcess),
    totalBRL: round2(brl + eurCovered * r.buyRate + eurExcess * r.sellRate),
  };
}

function requirementBlock(
  scenario: Scenario,
  finances: Finances,
  oneTimeLines: LineResult[],
  monthly: Money2,
  includeIncome: boolean,
  r: Rates,
): RequirementBlock {
  const active = oneTimeLines.filter((l) => !l.alreadyPaid);
  const definitive = sumLines(active.filter((l) => l.nature === 'definitivo'));
  const deposits = sumLines(active.filter((l) => l.nature === 'reembolsavel'));
  const runway = Math.floor(nn(scenario.runwayMonths));
  const runwayGross = scale(monthly, runway);
  const income = includeIncome ? applyIncome(runwayGross, scenario, runway, r).offset : zero();
  const runwayNet = { eur: runwayGross.eur - income.eur, brl: runwayGross.brl - income.brl };
  const contingency = scale(add(definitive, runwayNet), nn(scenario.contingencyPct) / 100);
  const emergency: Money2 =
    scenario.emergency.mode === 'meses'
      ? scale(monthly, nn(scenario.emergency.months))
      : { eur: 0, brl: nn(scenario.emergency.valueBRL) };
  const required = [definitive, deposits, runwayNet, contingency, emergency].reduce(add, zero());
  const requiredTotal = total(required, r);
  const available = availableOf(finances, required.eur, r);
  const shortfall = Math.max(0, requiredTotal.totalBRL - available.totalBRL);
  const surplus = Math.max(0, available.totalBRL - requiredTotal.totalBRL);
  return {
    oneTimeDefinitive: total(definitive, r),
    deposits: total(deposits, r),
    runwayGross: total(runwayGross, r),
    incomeOffset: total(income, r),
    runwayNet: total(runwayNet, r),
    contingency: total(contingency, r),
    emergency: total(emergency, r),
    required: requiredTotal,
    available,
    shortfallBRL: round2(shortfall),
    surplusBRL: round2(surplus),
    progressPct: requiredTotal.totalBRL > 0 ? Math.min(100, (available.totalBRL / requiredTotal.totalBRL) * 100) : 100,
  };
}

export function computePlan(client: Pick<Client, 'personal' | 'finances'>, scenario: Scenario): PlanResult {
  const household = householdOf(client);
  const rates = ratesOf(scenario);
  const blockers: string[] = [];
  if (rates.rate <= 0) blockers.push('Informe o câmbio (R$ por €) do cenário para calcular os valores em reais.');
  if (household.adults < 1) blockers.push('Informe ao menos 1 adulto na composição familiar.');

  const oneTimeLines = oneTimeLinesOf(scenario, household, rates);
  const monthlyLines = monthlyLinesOf(scenario, client.finances, household, rates);
  const monthlyMoney = sumLines(monthlyLines);
  const alreadyPaidBRL = round2(oneTimeLines.filter((l) => l.alreadyPaid).reduce((s, l) => s + l.subtotalBRL, 0));

  const withoutIncome = requirementBlock(scenario, client.finances, oneTimeLines, monthlyMoney, false, rates);
  const withIncome = requirementBlock(scenario, client.finances, oneTimeLines, monthlyMoney, true, rates);
  const incomeIncluded = scenario.income.includeInGoal && nn(scenario.income.monthlyAmount) > 0;
  const main = incomeIncluded ? withIncome : withoutIncome;

  const runwayMonths = Math.floor(nn(scenario.runwayMonths));
  const incomeMonthsInRunway = applyIncome(scale(monthlyMoney, runwayMonths), scenario, runwayMonths, rates).months;
  const incomeShare =
    withIncome.runwayGross.totalBRL > 0 ? withIncome.incomeOffset.totalBRL / withIncome.runwayGross.totalBRL : 0;

  // Sensibilidade: euros que ainda precisam ser comprados × R$ 0,10 × (1 + custo de conversão).
  const eurToBuy = Math.max(0, main.required.eur - main.available.eurCovered);
  const conv = rates.rate > 0 ? rates.buyRate / rates.rate : 1;
  const fxImpactPer10Cents = round2(eurToBuy * 0.1 * conv);

  return {
    valid: blockers.length === 0,
    blockers,
    household,
    rates,
    oneTimeLines,
    monthlyLines,
    alreadyPaidBRL,
    monthlyLiving: total(monthlyMoney, rates),
    runwayMonths,
    incomeMonthsInRunway,
    incomeShare,
    rentAdvance: rentAdvanceOf(scenario),
    main,
    withoutIncome,
    withIncome,
    incomeIncluded,
    fxImpactPer10Cents,
  };
}

/** Recalcula o plano com outro câmbio (para a tabela de sensibilidade). */
export function computeWithRate(client: Pick<Client, 'personal' | 'finances'>, scenario: Scenario, rate: number): PlanResult {
  return computePlan(client, { ...scenario, fx: { ...scenario.fx, rate } });
}
