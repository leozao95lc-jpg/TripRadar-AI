// Modelos de partida para perfis e cenários.
//
// IMPORTANTE: os valores abaixo NÃO são cotações. São pontos de partida para o
// consultor substituir por valores pesquisados, e por isso nascem com
// status 'sem_cotacao', sem fonte e sem data — o que dispara o alerta
// "custos sem cotação" até serem revisados.
//
// As diferenças entre Econômico / Intermediário / Conservador vêm de premissas
// explícitas por item (tipo de moradia, meses financiados, valor unitário),
// nunca de um percentual aplicado sobre o total.

import { addMonths, currentMonth } from '../lib/dates';
import { uid } from '../lib/id';
import type {
  ChecklistItem,
  Client,
  Currency,
  FxAssumptions,
  HousingType,
  MonthlyCategory,
  MonthlyCost,
  OneTimeCategory,
  OneTimeCost,
  OneTimeNature,
  ProfileKind,
  Scaling,
  Scenario,
  ScenarioLevel,
  Settings,
} from './types';
import { LEVEL_LABELS } from './labels';

export const TEMPLATE_SOURCE = 'Modelo inicial (não é cotação)';

type Tri = [number, number, number];
const LEVELS: Exclude<ScenarioLevel, 'personalizado'>[] = ['economico', 'intermediario', 'conservador'];
const idx = (level: ScenarioLevel) => Math.max(0, LEVELS.indexOf(level as (typeof LEVELS)[number]));

export const DEFAULT_SETTINGS: Settings = {
  productAPrice: 49,
  productBPrice: 197,
  consultationHours: 3.5,
  consultantNames: '',
  fxStaleDays: 7,
  priceStaleDays: 90,
  incomeDependencyLimitPct: 30,
  defaultFx: { rate: 0, quotedAt: '', source: '', conversionCostPct: 0 },
};

/** Aluguel de referência por tipo de moradia e nível (EUR/mês, parte do cliente). */
export const RENT_REFERENCE: Record<HousingType, Tri> = {
  quarto_compartilhado: [400, 500, 600],
  apartamento_compartilhado: [550, 700, 850],
  apartamento_independente: [850, 1100, 1350],
  moradia_familiar: [1100, 1400, 1750],
};

const HOUSING_BY_PROFILE: Record<ProfileKind, [HousingType, HousingType, HousingType]> = {
  sozinho: ['quarto_compartilhado', 'apartamento_compartilhado', 'apartamento_independente'],
  casal: ['quarto_compartilhado', 'apartamento_independente', 'apartamento_independente'],
  familia: ['moradia_familiar', 'moradia_familiar', 'moradia_familiar'],
};

export const PROFILE_HOUSEHOLD: Record<ProfileKind, { adults: number; children: number }> = {
  sozinho: { adults: 1, children: 0 },
  casal: { adults: 2, children: 0 },
  familia: { adults: 2, children: 2 },
};

interface ItemSpec<C> {
  category: C;
  name: string;
  values: Tri;
  scaling: Scaling;
  currency: Currency;
  quantity?: Tri;
  note?: string;
}

function blankMeta() {
  return { source: TEMPLATE_SOURCE, consultedAt: '', status: 'sem_cotacao' as const };
}

export function newOneTimeCost(partial: Partial<OneTimeCost> = {}): OneTimeCost {
  return {
    id: uid('ot'),
    category: 'outros',
    name: 'Novo custo',
    unitValue: 0,
    quantity: 1,
    scaling: 'fixo',
    currency: 'BRL',
    nature: 'definitivo',
    alreadyPaid: false,
    source: '',
    consultedAt: '',
    status: 'sem_cotacao',
    note: '',
    ...partial,
  };
}

export function newMonthlyCost(partial: Partial<MonthlyCost> = {}): MonthlyCost {
  return {
    id: uid('mc'),
    category: 'outros',
    name: 'Novo custo mensal',
    unitValue: 0,
    quantity: 1,
    scaling: 'fixo',
    currency: 'EUR',
    source: '',
    consultedAt: '',
    status: 'sem_cotacao',
    note: '',
    ...partial,
  };
}

interface Context {
  profile: ProfileKind;
  pets: number;
  children: number;
  ticketsBought: boolean;
  needsTempLodging: boolean;
}

function oneTimeSpecs(ctx: Context): (ItemSpec<OneTimeCategory> & { nature?: OneTimeNature })[] {
  const family = ctx.profile === 'familia';
  const specs: (ItemSpec<OneTimeCategory> & { nature?: OneTimeNature })[] = [
    { category: 'passagens', name: 'Passagens aéreas (só ida)', values: [3500, 4500, 6000], scaling: 'por_pessoa', currency: 'BRL' },
    { category: 'bagagem', name: 'Bagagem extra', values: [0, 400, 800], scaling: 'por_adulto', currency: 'BRL' },
    { category: 'documentacao', name: 'Certidões e documentos', values: [200, 300, 400], scaling: 'por_pessoa', currency: 'BRL' },
    {
      category: 'apostilamento_traducao',
      name: 'Apostilamentos e traduções juramentadas',
      values: [500, 800, 1100],
      scaling: 'por_pessoa',
      currency: 'BRL',
      note: 'Quantidade de documentos depende da via migratória — verificar em fonte oficial.',
    },
    {
      category: 'taxas_administrativas',
      name: 'Taxas administrativas',
      values: [50, 80, 100],
      scaling: 'por_adulto',
      currency: 'EUR',
      note: 'Valores e obrigatoriedade variam por procedimento — verificar em fonte oficial.',
    },
    {
      category: 'seguro_inicial',
      name: 'Seguro / cobertura inicial',
      values: [300, 500, 800],
      scaling: 'por_pessoa',
      currency: 'BRL',
      note: 'Exigência e tipo de cobertura dependem da via migratória — verificar.',
    },
    { category: 'transporte_local', name: 'Transporte local inicial', values: [50, 100, 150], scaling: 'fixo', currency: 'EUR' },
    {
      category: 'instalacao',
      name: 'Instalação e utensílios',
      values: family ? [600, 1200, 2000] : [300, 700, 1200],
      scaling: 'fixo',
      currency: 'EUR',
    },
  ];
  if (ctx.needsTempLodging) {
    specs.push({
      category: 'hospedagem_temporaria',
      name: 'Hospedagem temporária (diárias)',
      values: family ? [70, 95, 120] : ctx.profile === 'casal' ? [55, 75, 95] : [40, 60, 80],
      quantity: [14, 21, 30],
      scaling: 'fixo',
      currency: 'EUR',
      note: 'Quantidade = número de noites até conseguir moradia fixa.',
    });
  }
  if (ctx.pets > 0) {
    specs.push({
      category: 'animais',
      name: 'Transporte de animais',
      values: [4000, 6000, 9000],
      scaling: 'por_animal',
      currency: 'BRL',
      note: 'Inclui exigências sanitárias — verificar regras da companhia aérea e do destino.',
    });
  }
  return specs;
}

function monthlySpecs(ctx: Context): ItemSpec<MonthlyCategory>[] {
  const specs: ItemSpec<MonthlyCategory>[] = [
    { category: 'utilidades', name: 'Eletricidade, água e gás (base)', values: [60, 90, 120], scaling: 'fixo', currency: 'EUR' },
    { category: 'utilidades', name: 'Eletricidade, água e gás (adicional por pessoa)', values: [15, 20, 25], scaling: 'por_pessoa', currency: 'EUR' },
    { category: 'internet_telefone', name: 'Internet residencial', values: [30, 35, 45], scaling: 'fixo', currency: 'EUR' },
    { category: 'internet_telefone', name: 'Plano de celular', values: [10, 15, 20], scaling: 'por_adulto', currency: 'EUR' },
    { category: 'supermercado', name: 'Supermercado (adultos)', values: [200, 250, 320], scaling: 'por_adulto', currency: 'EUR' },
    { category: 'transporte', name: 'Transporte público', values: [20, 40, 55], scaling: 'por_adulto', currency: 'EUR' },
    {
      category: 'saude_seguros',
      name: 'Seguro saúde',
      values: [40, 60, 90],
      scaling: 'por_pessoa',
      currency: 'EUR',
      note: 'Se a via migratória exigir seguro privado, use o valor da apólice exigida.',
    },
    { category: 'lazer', name: 'Lazer', values: [40, 80, 120], scaling: 'por_pessoa', currency: 'EUR' },
    { category: 'pessoais', name: 'Despesas pessoais', values: [50, 80, 120], scaling: 'por_adulto', currency: 'EUR' },
    { category: 'outros', name: 'Outros recorrentes', values: [0, 30, 60], scaling: 'fixo', currency: 'EUR' },
  ];
  if (ctx.children > 0 || ctx.profile === 'familia') {
    specs.push(
      { category: 'supermercado', name: 'Supermercado (crianças)', values: [120, 160, 200], scaling: 'por_crianca', currency: 'EUR' },
      { category: 'transporte', name: 'Transporte (crianças)', values: [0, 10, 20], scaling: 'por_crianca', currency: 'EUR' },
      {
        category: 'educacao',
        name: 'Educação e mensalidades',
        values: [0, 100, 300],
        scaling: 'por_crianca',
        currency: 'EUR',
        note: 'Econômico considera escola pública; demais incluem material, refeição ou escola privada/concertada.',
      },
      { category: 'criancas', name: 'Roupas e atividades das crianças', values: [50, 80, 120], scaling: 'por_crianca', currency: 'EUR' },
    );
  }
  if (ctx.pets > 0) {
    specs.push({ category: 'animais', name: 'Ração, veterinário e cuidados', values: [40, 60, 90], scaling: 'por_animal', currency: 'EUR' });
  }
  return specs;
}

export function buildScenario(level: Exclude<ScenarioLevel, 'personalizado'>, ctx: Context, fx: FxAssumptions): Scenario {
  const i = idx(level);
  const housingType = HOUSING_BY_PROFILE[ctx.profile][i];
  const oneTimeCosts = oneTimeSpecs(ctx).map((s) =>
    newOneTimeCost({
      category: s.category,
      name: s.name,
      unitValue: s.values[i],
      quantity: s.quantity ? s.quantity[i] : 1,
      scaling: s.scaling,
      currency: s.currency,
      nature: s.nature ?? 'definitivo',
      alreadyPaid: s.category === 'passagens' && ctx.ticketsBought,
      note: s.note ?? '',
      ...blankMeta(),
    }),
  );
  const monthlyCosts = monthlySpecs(ctx).map((s) =>
    newMonthlyCost({
      category: s.category,
      name: s.name,
      unitValue: s.values[i],
      quantity: 1,
      scaling: s.scaling,
      currency: s.currency,
      note: s.note ?? '',
      ...blankMeta(),
    }),
  );
  return {
    id: uid('sc'),
    name: LEVEL_LABELS[level],
    level,
    housing: {
      type: housingType,
      monthlyRent: RENT_REFERENCE[housingType][i],
      currency: 'EUR',
      depositMonths: ([1, 2, 2] as Tri)[i],
      agencyFeeMonths: ([0, 1, 1] as Tri)[i],
      advanceRentMonths: 1,
      note: '',
      ...blankMeta(),
    },
    oneTimeCosts,
    monthlyCosts,
    runwayMonths: ([3, 4, 6] as Tri)[i],
    emergency: { mode: 'meses', months: ([2, 3, 6] as Tri)[i], valueBRL: 0 },
    contingencyPct: ([5, 10, 15] as Tri)[i],
    costIncreasePctYear: ([0, 3, 5] as Tri)[i],
    fx: { ...fx },
    income: {
      description: '',
      monthlyAmount: 0,
      currency: 'EUR',
      startMonth: 3,
      confirmed: false,
      includeInGoal: false,
    },
    notes: '',
    updatedAt: new Date().toISOString(),
  };
}

export function buildDefaultScenarios(ctx: Context, fx: FxAssumptions): Scenario[] {
  return LEVELS.map((l) => buildScenario(l, ctx, fx));
}

export function buildChecklist(ctx: { children: number; pets: number; ticketsBought: boolean; needsTempLodging: boolean }): ChecklistItem[] {
  const item = (group: string, title: string, detail = '', requiresOfficialCheck = false, done = false): ChecklistItem => ({
    id: uid('ck'),
    group,
    title,
    detail,
    status: done ? 'concluida' : 'pendente',
    requiresOfficialCheck,
    dueDate: '',
    note: '',
  });
  const items: ChecklistItem[] = [
    item('Pesquisa de cidades', 'Comparar custo de vida das cidades consideradas', 'Aluguel, transporte e oferta de trabalho na área do cliente.'),
    item('Pesquisa de cidades', 'Definir a cidade principal e uma alternativa'),
    item('Pesquisa de moradia', 'Pesquisar aluguéis no tipo de moradia escolhido', 'Registrar fonte e data de cada valor encontrado na planilha.'),
    item('Pesquisa de moradia', 'Levantar exigências usuais dos proprietários', 'Caução, comprovação de renda, fiador, comissão de agência.'),
    item('Planejamento de documentos', 'Listar documentos exigidos pela via migratória declarada', 'A lista depende da via e do consulado — verificar em fonte oficial.', true),
    item('Planejamento de documentos', 'Emitir certidões e providenciar apostilamentos', 'Prazos de validade dos documentos devem ser confirmados em fonte oficial.', true),
    item('Planejamento de documentos', 'Traduções juramentadas, se exigidas', '', true),
    item('Verificação de requisitos oficiais', 'Confirmar requisitos da via migratória em fonte oficial', 'Consulado/Embaixada da Espanha e sites do governo espanhol. Registrar a data da consulta.', true),
    item('Verificação de requisitos oficiais', 'Confirmar se há exigência de comprovação de meios econômicos', 'Valor e forma de comprovação devem ser verificados em fonte oficial.', true),
    item('Verificação de requisitos oficiais', 'Confirmar exigência de seguro saúde e tipo de cobertura', '', true),
    item('Orçamento de passagens', 'Cotar passagens e registrar data e fonte', '', false, ctx.ticketsBought),
    item('Orçamento de passagens', 'Verificar franquia de bagagem e custo de bagagem extra'),
    item('Reserva financeira', 'Atingir a meta de recursos do cenário escolhido'),
    item('Reserva financeira', 'Definir como e quando converter reais em euros', 'Considerar custo de conversão e risco de alta do euro.'),
    item('Reserva financeira', 'Separar a reserva de emergência e não usá-la para custos planejados'),
    item('Planejamento de chegada', 'Planejar os primeiros 30 dias (endereço, transporte, chip, conta)'),
    item('Planejamento de chegada', 'Verificar procedimentos de registro após a chegada', 'Prazos e exigências devem ser confirmados em fonte oficial.', true),
    item('Organização de despesas', 'Encerrar ou transferir contas recorrentes no Brasil'),
    item('Organização de despesas', 'Definir como serão pagas parcelas que continuam no Brasil'),
    item('Plano de contingência', 'Definir gatilhos de corte de gastos se a renda atrasar'),
    item('Plano de contingência', 'Definir até quando a reserva sustenta a família sem renda', 'Usar o período financiado e a reserva de emergência do cenário.'),
  ];
  if (ctx.needsTempLodging) {
    items.push(item('Pesquisa de moradia', 'Reservar hospedagem temporária para a chegada'));
  }
  if (ctx.children > 0) {
    items.push(
      item('Planejamento de documentos', 'Documentação das crianças (histórico escolar, vacinação)', 'Exigências devem ser verificadas em fonte oficial.', true),
      item('Planejamento de chegada', 'Pesquisar escolas e processo de matrícula', 'Calendário e regras de matrícula devem ser verificados com a administração local.', true),
    );
  }
  if (ctx.pets > 0) {
    items.push(
      item('Planejamento de documentos', 'Requisitos sanitários para viagem do animal', 'Vacinas, microchip e prazos — verificar em fonte oficial e com a companhia aérea.', true),
      item('Orçamento de passagens', 'Cotar transporte do animal com a companhia aérea ou empresa especializada'),
    );
  }
  return items;
}

export function newClient(profile: ProfileKind, settings: Settings, now: Date = new Date()): Client {
  const hh = PROFILE_HOUSEHOLD[profile];
  const ctx: Context = { profile, pets: 0, children: hh.children, ticketsBought: false, needsTempLodging: true };
  const scenarios = buildDefaultScenarios(ctx, settings.defaultFx);
  const start = addMonths(currentMonth(now), 1);
  const iso = now.toISOString();
  return {
    id: uid('cl'),
    createdAt: iso,
    updatedAt: iso,
    status: 'rascunho',
    profile,
    personal: {
      name: '',
      email: '',
      phone: '',
      adults: hh.adults,
      children: hh.children,
      childrenAges: '',
      pets: 0,
      petDetails: '',
      familySituation: '',
      financialDependents: '',
    },
    move: {
      targetCity: '',
      otherCities: '',
      targetMonth: addMonths(start, 12),
      dateFlexibility: 'ate_3_meses',
      goal: '',
      migrationRoute: '',
      documentationStatus: '',
      ticketsBought: false,
      needsTempLodging: true,
      housingIntent: scenarios[1].housing.type,
    },
    finances: {
      reserveBRL: 0,
      reserveEUR: 0,
      otherResourcesBRL: 0,
      otherResourcesNote: '',
      preservedBRL: 0,
      monthlyIncomeBRL: 0,
      monthlyExpensesBRL: 0,
      monthlyDebtBRL: 0,
      savingsCapacityBRL: 0,
      incomeAfterArrival: 'nenhuma',
      incomeAfterArrivalNote: '',
      safetyReserveBRL: 0,
      ongoingBrazilMonthlyBRL: 0,
    },
    scenarios,
    selectedScenarioId: scenarios[1].id,
    savingsPlan: { startMonth: start, periods: [], contributions: [], extraExpenses: [] },
    checklist: buildChecklist(ctx),
    notes: { objectives: '', risks: '', decisions: '', pending: '', recommendations: '', nextSteps: '', general: '' },
    deliveries: [],
  };
}

/** Recria os 3 cenários-modelo a partir dos dados atuais do cliente (substitui os existentes). */
export function rebuildScenariosFor(client: Client, fx: FxAssumptions): Scenario[] {
  return buildDefaultScenarios(
    {
      profile: client.profile,
      pets: client.personal.pets,
      children: client.personal.children,
      ticketsBought: client.move.ticketsBought,
      needsTempLodging: client.move.needsTempLodging,
    },
    fx,
  );
}
