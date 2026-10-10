import { describe, expect, it } from 'vitest';
import { analyze } from './analysis';
import { computePlan, computeWithRate } from './calc';
import { projectSavings } from './savings';
import { DEFAULT_SETTINGS, newClient, newMonthlyCost, newOneTimeCost, rebuildScenariosFor } from './templates';
import type { Client, MonthlyCost, OneTimeCost, ProfileKind, Scenario } from './types';

const TODAY = '2026-10-10';
const SETTINGS = { ...DEFAULT_SETTINGS, defaultFx: { rate: 6, quotedAt: TODAY, source: 'teste', conversionCostPct: 0 } };

function scenario(over: Partial<Scenario> & { oneTime?: Partial<OneTimeCost>[]; monthly?: Partial<MonthlyCost>[] }): Scenario {
  const quoted = { source: 'teste', consultedAt: TODAY, status: 'confirmado' as const };
  return {
    id: 'sc_test',
    name: 'Teste',
    level: 'personalizado',
    housing: {
      type: 'apartamento_independente',
      monthlyRent: 0,
      currency: 'EUR',
      depositMonths: 0,
      agencyFeeMonths: 0,
      advanceRentMonths: 1,
      note: '',
      ...quoted,
      ...over.housing,
    },
    oneTimeCosts: (over.oneTime ?? []).map((o) => newOneTimeCost({ ...quoted, ...o })),
    monthlyCosts: (over.monthly ?? []).map((m) => newMonthlyCost({ ...quoted, ...m })),
    runwayMonths: over.runwayMonths ?? 3,
    emergency: over.emergency ?? { mode: 'meses', months: 0, valueBRL: 0 },
    contingencyPct: over.contingencyPct ?? 0,
    costIncreasePctYear: over.costIncreasePctYear ?? 0,
    fx: over.fx ?? { rate: 6, quotedAt: TODAY, source: 'teste', conversionCostPct: 0 },
    income: over.income ?? { description: '', monthlyAmount: 0, currency: 'EUR', startMonth: 1, confirmed: false, includeInGoal: false },
    notes: '',
    updatedAt: TODAY,
  };
}

function client(profile: ProfileKind, over: { adults?: number; children?: number; pets?: number; finances?: Partial<Client['finances']>; targetMonth?: string }, sc: Scenario): Client {
  const c = newClient(profile, SETTINGS, new Date('2026-10-10T12:00:00Z'));
  c.personal.adults = over.adults ?? c.personal.adults;
  c.personal.children = over.children ?? c.personal.children;
  c.personal.pets = over.pets ?? 0;
  c.finances = { ...c.finances, ...over.finances };
  c.move.targetMonth = over.targetMonth ?? c.move.targetMonth;
  c.scenarios = [sc];
  c.selectedScenarioId = sc.id;
  c.savingsPlan.startMonth = '2026-11';
  return c;
}

describe('Caso 1 — pessoa sozinha com reserva suficiente', () => {
  const sc = scenario({
    housing: { type: 'quarto_compartilhado', monthlyRent: 500, depositMonths: 2 } as Scenario['housing'],
    oneTime: [
      { name: 'Passagem', unitValue: 4000, scaling: 'por_pessoa', currency: 'BRL' },
      { name: 'Instalação', unitValue: 300, scaling: 'fixo', currency: 'EUR' },
    ],
    monthly: [
      { name: 'Supermercado', unitValue: 250, scaling: 'por_adulto', currency: 'EUR' },
      { name: 'Demais', unitValue: 250, scaling: 'fixo', currency: 'EUR' },
    ],
    runwayMonths: 3,
    emergency: { mode: 'meses', months: 2, valueBRL: 0 },
    contingencyPct: 10,
  });
  const c = client('sozinho', { adults: 1, finances: { reserveBRL: 50000, savingsCapacityBRL: 2000 } }, sc);
  const a = analyze(c, SETTINGS, TODAY);

  it('separa os componentes por moeda', () => {
    expect(a.plan.monthlyLiving).toEqual({ eur: 1000, brl: 0, totalBRL: 6000 });
    expect(a.plan.main.oneTimeDefinitive).toEqual({ eur: 300, brl: 4000, totalBRL: 5800 });
    expect(a.plan.main.deposits).toEqual({ eur: 1000, brl: 0, totalBRL: 6000 });
    expect(a.plan.main.runwayNet.eur).toBe(3000);
    expect(a.plan.main.contingency).toEqual({ eur: 330, brl: 400, totalBRL: 2380 });
    expect(a.plan.main.emergency.eur).toBe(2000);
  });

  it('calcula a meta e não deixa valor faltante', () => {
    expect(a.plan.main.required).toEqual({ eur: 6630, brl: 4400, totalBRL: 44180 });
    expect(a.plan.main.available.totalBRL).toBe(50000);
    expect(a.plan.main.shortfallBRL).toBe(0);
    expect(a.plan.main.surplusBRL).toBe(5820);
    expect(a.plan.main.progressPct).toBe(100);
    expect(a.projection.monthsToGoal).toBe(0);
  });

  it('não classifica o plano como seguro só por atingir a meta', () => {
    expect(a.alerts.find((x) => x.id === 'meta_matematica')).toBeDefined();
    expect(a.alerts.find((x) => x.id === 'reserva_insuficiente')).toBeUndefined();
  });
});

describe('Caso 2 — casal com reserva insuficiente e poupança positiva', () => {
  const sc = scenario({
    housing: { type: 'apartamento_independente', monthlyRent: 1000, depositMonths: 1, agencyFeeMonths: 1, advanceRentMonths: 1 } as Scenario['housing'],
    oneTime: [{ name: 'Passagem', unitValue: 4000, scaling: 'por_pessoa', currency: 'BRL' }],
    monthly: [
      { name: 'Supermercado', unitValue: 250, scaling: 'por_adulto', currency: 'EUR' },
      { name: 'Internet', unitValue: 40, scaling: 'fixo', currency: 'EUR' },
    ],
    runwayMonths: 4,
    emergency: { mode: 'meses', months: 3, valueBRL: 0 },
    contingencyPct: 10,
    fx: { rate: 6, quotedAt: TODAY, source: 'teste', conversionCostPct: 5 },
  });
  const c = client(
    'casal',
    { adults: 2, targetMonth: '2027-11', finances: { reserveBRL: 30000, reserveEUR: 2000, preservedBRL: 5000, savingsCapacityBRL: 3000 } },
    sc,
  );
  const a = analyze(c, SETTINGS, TODAY);

  it('aplica custo de conversão e não dobra itens compartilhados', () => {
    expect(a.plan.rates.buyRate).toBeCloseTo(6.3);
    // aluguel 1000 + internet 40 (fixos) + supermercado 250 × 2
    expect(a.plan.monthlyLiving.eur).toBe(1540);
    expect(a.plan.main.required.eur).toBe(13496);
    expect(a.plan.main.required.brl).toBe(8800);
    expect(a.plan.main.required.totalBRL).toBeCloseTo(93824.8, 2);
  });

  it('exclui o valor preservado e usa euros próprios antes de comprar', () => {
    expect(a.plan.main.available.brl).toBe(25000);
    expect(a.plan.main.available.eurCovered).toBe(2000);
    expect(a.plan.main.available.totalBRL).toBe(37600);
    expect(a.plan.main.shortfallBRL).toBeCloseTo(56224.8, 2);
  });

  it('projeta 19 meses e sinaliza poupança incompatível com a data', () => {
    expect(a.projection.monthsToGoal).toBe(19);
    expect(a.projection.reachedMonth).toBe('2028-05');
    expect(a.projection.monthsUntilMove).toBe(12);
    expect(a.projection.requiredMonthlyToMove).toBeCloseTo(4685.4, 1);
    const ids = a.alerts.map((x) => x.id);
    expect(ids).toContain('reserva_insuficiente');
    expect(ids).toContain('poupanca_incompativel');
    expect(ids).toContain('data_anterior_meta');
    expect(ids).not.toContain('meta_inatingivel');
  });
});

describe('Caso 3 — família com poupança mensal igual a zero', () => {
  const sc = scenario({
    housing: { type: 'moradia_familiar', monthlyRent: 1400, depositMonths: 2, agencyFeeMonths: 1, advanceRentMonths: 2 } as Scenario['housing'],
    oneTime: [
      { name: 'Passagem', unitValue: 3000, scaling: 'por_pessoa', currency: 'BRL' },
      { name: 'Transporte do pet', unitValue: 5000, scaling: 'por_animal', currency: 'BRL' },
    ],
    monthly: [
      { name: 'Supermercado adultos', unitValue: 250, scaling: 'por_adulto', currency: 'EUR' },
      { name: 'Supermercado crianças', unitValue: 150, scaling: 'por_crianca', currency: 'EUR' },
      { name: 'Educação', unitValue: 100, scaling: 'por_crianca', currency: 'EUR' },
      { name: 'Pet', unitValue: 50, scaling: 'por_animal', currency: 'EUR' },
    ],
    runwayMonths: 3,
    emergency: { mode: 'meses', months: 3, valueBRL: 0 },
    contingencyPct: 10,
  });
  const c = client('familia', { adults: 2, children: 2, pets: 1, finances: { reserveBRL: 40000, savingsCapacityBRL: 0 } }, sc);
  const a = analyze(c, SETTINGS, TODAY);

  it('escala por adultos, crianças e animais', () => {
    expect(a.plan.monthlyLiving.eur).toBe(2450);
    expect(a.plan.main.oneTimeDefinitive).toEqual({ eur: 1400, brl: 17000, totalBRL: 25400 });
    expect(a.plan.rentAdvance).toEqual({ months: 2, inRunway: 2, excess: 0 });
    expect(a.plan.main.required.totalBRL).toBe(137350);
    expect(a.plan.main.shortfallBRL).toBe(97350);
  });

  it('não inventa data de chegada', () => {
    expect(a.projection.monthsToGoal).toBeNull();
    expect(a.projection.unreachable).toBe(true);
    expect(a.projection.reachedMonth).toBeNull();
    expect(a.alerts[0].id).toBe('meta_inatingivel');
    expect(a.alerts[0].severity).toBe('critico');
  });
});

describe('Regras de não contagem dupla e moedas', () => {
  it('custo já pago não entra na meta', () => {
    const sc = scenario({ oneTime: [{ name: 'Passagem', unitValue: 4000, scaling: 'por_pessoa', currency: 'BRL', alreadyPaid: true }] });
    const p = computePlan(client('sozinho', { adults: 1 }, sc), sc);
    expect(p.main.required.totalBRL).toBe(0);
    expect(p.alreadyPaidBRL).toBe(4000);
  });

  it('aluguel antecipado só soma o que excede o período financiado', () => {
    const sc = scenario({ housing: { monthlyRent: 1000, advanceRentMonths: 4 } as Scenario['housing'], runwayMonths: 3 });
    const p = computePlan(client('sozinho', { adults: 1 }, sc), sc);
    expect(p.rentAdvance.excess).toBe(1);
    // 3 meses de aluguel no custo de vida + 1 mês excedente
    expect(p.main.required.eur).toBe(4000);
  });

  it('euros excedentes valem câmbio de venda', () => {
    const sc = scenario({ oneTime: [{ name: 'X', unitValue: 100, currency: 'EUR' }], runwayMonths: 0, fx: { rate: 6, quotedAt: TODAY, source: 't', conversionCostPct: 10 } });
    const p = computePlan(client('sozinho', { adults: 1, finances: { reserveEUR: 300 } }, sc), sc);
    // 100 € cobrem a necessidade (a 6,60), 200 € sobram (a 5,40)
    expect(p.main.available.totalBRL).toBeCloseTo(100 * 6.6 + 200 * 5.4, 6);
    expect(p.main.shortfallBRL).toBe(0);
  });

  it('valor preservado maior que os reais consome euros', () => {
    const sc = scenario({ runwayMonths: 0, fx: { rate: 5, quotedAt: TODAY, source: 't', conversionCostPct: 0 } });
    const p = computePlan(client('sozinho', { adults: 1, finances: { reserveBRL: 1000, reserveEUR: 1000, preservedBRL: 2000 } }, sc), sc);
    expect(p.main.available.brl).toBe(0);
    expect(p.main.available.eur).toBe(800);
  });

  it('renda futura só reduz a meta quando incluída, e sinaliza se não confirmada', () => {
    const base = {
      monthly: [{ name: 'Vida', unitValue: 2000, currency: 'EUR' as const }],
      runwayMonths: 4,
    };
    const income = { description: 'Trabalho remoto', monthlyAmount: 1000, currency: 'EUR' as const, startMonth: 2, confirmed: false, includeInGoal: false };
    const off = scenario({ ...base, income });
    const on = scenario({ ...base, income: { ...income, includeInGoal: true } });
    const pOff = computePlan(client('sozinho', { adults: 1 }, off), off);
    const pOn = computePlan(client('sozinho', { adults: 1 }, on), on);
    expect(pOff.main.required.eur).toBe(8000);
    expect(pOn.main.required.eur).toBe(5000); // meses 2, 3 e 4 com renda
    expect(pOn.withoutIncome.required.eur).toBe(8000);
    expect(pOn.incomeShare).toBeCloseTo(3000 / 8000);
    const a = analyze(client('sozinho', { adults: 1 }, on), SETTINGS, TODAY);
    expect(a.alerts.map((x) => x.id)).toEqual(expect.arrayContaining(['renda_nao_confirmada', 'dependencia_renda']));
  });

  it('renda maior que o custo nunca deixa o custo de vida negativo', () => {
    const sc = scenario({
      monthly: [{ name: 'Vida', unitValue: 500, currency: 'EUR' }],
      runwayMonths: 2,
      income: { description: '', monthlyAmount: 5000, currency: 'EUR', startMonth: 1, confirmed: true, includeInGoal: true },
    });
    const p = computePlan(client('sozinho', { adults: 1 }, sc), sc);
    expect(p.main.runwayNet.eur).toBe(0);
    expect(p.main.required.totalBRL).toBe(0);
  });

  it('câmbio zerado bloqueia o cálculo em vez de zerar os euros silenciosamente', () => {
    const sc = scenario({ fx: { rate: 0, quotedAt: '', source: '', conversionCostPct: 0 } });
    const p = computePlan(client('sozinho', { adults: 1 }, sc), sc);
    expect(p.valid).toBe(false);
    expect(p.blockers.length).toBeGreaterThan(0);
  });

  it('valores negativos são tratados como zero', () => {
    const sc = scenario({ oneTime: [{ name: 'Erro', unitValue: -500, currency: 'BRL' }] });
    const p = computePlan(client('sozinho', { adults: 1 }, sc), sc);
    expect(p.main.required.totalBRL).toBe(0);
  });

  it('sensibilidade cambial é coerente com o recálculo', () => {
    const sc = scenario({ monthly: [{ name: 'Vida', unitValue: 1000, currency: 'EUR' }], runwayMonths: 3 });
    const c = client('sozinho', { adults: 1 }, sc);
    const p = computePlan(c, sc);
    const p2 = computeWithRate(c, sc, 6.1);
    expect(p2.main.required.totalBRL - p.main.required.totalBRL).toBeCloseTo(p.fxImpactPer10Cents, 6);
  });
});

describe('Projeção de poupança', () => {
  const plan = { startMonth: '2027-01', periods: [], contributions: [], extraExpenses: [] };

  it('respeita períodos, aportes e despesas extraordinárias', () => {
    const r = projectSavings({
      startBalance: 1000,
      goalToday: 10000,
      baseSavings: 1000,
      plan: {
        ...plan,
        periods: [{ id: 'p', fromMonth: 3, toMonth: 4, amount: 0 }],
        contributions: [{ id: 'c', month: 2, amount: 5000, description: '13º' }],
        extraExpenses: [{ id: 'e', month: 5, amount: 500, description: 'Curso' }],
      },
      costIncreasePctYear: 0,
      targetMonth: '2027-07',
    });
    expect(r.rows.slice(0, 6).map((x) => x.closing)).toEqual([2000, 8000, 8000, 8000, 8500, 9500]);
    expect(r.monthsToGoal).toBe(7);
    expect(r.reachedMonth).toBe('2027-07');
    expect(r.rows).toHaveLength(36);
  });

  it('meta com aumento de custos cresce mês a mês', () => {
    const r = projectSavings({ startBalance: 0, goalToday: 12000, baseSavings: 1000, plan, costIncreasePctYear: 10, targetMonth: '2028-01' });
    expect(r.rows[11].goal).toBeCloseTo(13200, 0);
    expect(r.monthsToGoal).toBeGreaterThan(12);
  });

  it('poupança negativa nunca gera data', () => {
    const r = projectSavings({ startBalance: 0, goalToday: 1000, baseSavings: -200, plan, costIncreasePctYear: 0, targetMonth: '2027-06' });
    expect(r.unreachable).toBe(true);
  });

  it('meta fora do horizonte de 36 meses é marcada', () => {
    const r = projectSavings({ startBalance: 0, goalToday: 50000, baseSavings: 1000, plan, costIncreasePctYear: 0, targetMonth: '2027-06' });
    expect(r.monthsToGoal).toBe(50);
    expect(r.beyondHorizon).toBe(true);
  });
});

describe('Modelos de cenário', () => {
  for (const profile of ['sozinho', 'casal', 'familia'] as ProfileKind[]) {
    it(`${profile}: econômico ≤ intermediário ≤ conservador`, () => {
      const c = newClient(profile, SETTINGS);
      c.scenarios = rebuildScenariosFor(c, SETTINGS.defaultFx);
      const totals = c.scenarios.map((s) => computePlan(c, s).main.required.totalBRL);
      expect(totals[0]).toBeGreaterThan(0);
      expect(totals[0]).toBeLessThanOrEqual(totals[1]);
      expect(totals[1]).toBeLessThanOrEqual(totals[2]);
    });
  }

  it('valores do modelo nascem marcados como sem cotação', () => {
    const c = newClient('casal', SETTINGS);
    const a = analyze(c, SETTINGS, TODAY);
    expect(a.alerts.map((x) => x.id)).toContain('sem_cotacao');
  });

  it('casal não custa o dobro de uma pessoa no mesmo cenário', () => {
    const solo = newClient('sozinho', SETTINGS);
    const couple = newClient('sozinho', SETTINGS);
    couple.personal.adults = 2;
    const s = solo.scenarios[1];
    const one = computePlan(solo, s).monthlyLiving.totalBRL;
    const two = computePlan(couple, s).monthlyLiving.totalBRL;
    expect(two).toBeGreaterThan(one);
    expect(two).toBeLessThan(2 * one);
  });
});
