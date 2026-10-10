// Modelo de dados do Espanha Planejada.
// Convenções:
//  - Valores monetários sempre acompanhados de `currency` (BRL ou EUR).
//  - Datas de consulta em ISO 'YYYY-MM-DD'; meses em 'YYYY-MM'.
//  - Nada aqui é cotação real: valores de modelo vêm marcados como 'sem_cotacao'.

export type Currency = 'BRL' | 'EUR';

/** Grau de confiança de um valor. */
export type ValueStatus = 'confirmado' | 'estimado' | 'sem_cotacao';

/** Natureza de um custo único: gasto definitivo ou depósito potencialmente reembolsável. */
export type OneTimeNature = 'definitivo' | 'reembolsavel';

/**
 * Como a quantidade de um item escala com a composição familiar.
 * O subtotal é: valor unitário × quantidade × multiplicador da regra.
 * Isso evita a premissa errada de que duas pessoas custam o dobro de uma:
 * itens compartilhados (aluguel, internet) são 'fixo'.
 */
export type Scaling = 'fixo' | 'por_adulto' | 'por_crianca' | 'por_pessoa' | 'por_animal';

export type HousingType =
  | 'quarto_compartilhado'
  | 'apartamento_compartilhado'
  | 'apartamento_independente'
  | 'moradia_familiar';

export type ScenarioLevel = 'economico' | 'intermediario' | 'conservador' | 'personalizado';
export type ProfileKind = 'sozinho' | 'casal' | 'familia';

export type OneTimeCategory =
  | 'passagens'
  | 'bagagem'
  | 'documentacao'
  | 'apostilamento_traducao'
  | 'taxas_administrativas'
  | 'seguro_inicial'
  | 'hospedagem_temporaria'
  | 'transporte_local'
  | 'instalacao'
  | 'animais'
  | 'deposito_outros'
  | 'outros';

export type MonthlyCategory =
  | 'utilidades'
  | 'internet_telefone'
  | 'supermercado'
  | 'transporte'
  | 'saude_seguros'
  | 'educacao'
  | 'criancas'
  | 'animais'
  | 'lazer'
  | 'pessoais'
  | 'compromissos_brasil'
  | 'outros';

/** Rastreabilidade de um preço: de onde veio, quando, e quão confiável é. */
export interface PriceMeta {
  source: string;
  consultedAt: string; // 'YYYY-MM-DD' ou ''
  status: ValueStatus;
  note: string;
}

export interface CostItem extends PriceMeta {
  id: string;
  name: string;
  unitValue: number;
  quantity: number;
  scaling: Scaling;
  currency: Currency;
}

export interface OneTimeCost extends CostItem {
  category: OneTimeCategory;
  nature: OneTimeNature;
  /** Já pago (ex.: passagens compradas). Não entra no que falta juntar, nem nos recursos. */
  alreadyPaid: boolean;
}

export interface MonthlyCost extends CostItem {
  category: MonthlyCategory;
}

export interface HousingAssumptions extends PriceMeta {
  type: HousingType;
  /** Aluguel mensal da moradia (parte que cabe ao cliente). */
  monthlyRent: number;
  currency: Currency;
  /** Caução/fiança em meses de aluguel — reembolsável. */
  depositMonths: number;
  /** Comissão/taxa de intermediação em meses de aluguel — gasto definitivo. */
  agencyFeeMonths: number;
  /** Meses de aluguel pagos antecipadamente na assinatura (incluindo o 1º). */
  advanceRentMonths: number;
}

export interface FxAssumptions {
  /** Reais por 1 euro. 0 = não informado (bloqueia o cálculo). */
  rate: number;
  quotedAt: string;
  source: string;
  /** Custo total de conversão (spread + IOF + tarifas), em %. */
  conversionCostPct: number;
}

export interface FutureIncome {
  description: string;
  monthlyAmount: number;
  currency: Currency;
  /** Mês de vida na Espanha em que a renda começa (1 = primeiro mês). */
  startMonth: number;
  confirmed: boolean;
  /** Se verdadeiro, a renda reduz a meta. Nunca é o padrão. */
  includeInGoal: boolean;
}

export interface EmergencyReserve {
  mode: 'meses' | 'valor';
  /** Meses de custo de vida mantidos intocados. */
  months: number;
  /** Valor fixo em reais (modo 'valor'). */
  valueBRL: number;
}

export interface Scenario {
  id: string;
  name: string;
  level: ScenarioLevel;
  housing: HousingAssumptions;
  oneTimeCosts: OneTimeCost[];
  monthlyCosts: MonthlyCost[];
  /** Meses de custo de vida financiados pela reserva (período sem depender de renda). */
  runwayMonths: number;
  emergency: EmergencyReserve;
  /** Margem para imprevistos (%) sobre custos únicos definitivos + custo de vida financiado. */
  contingencyPct: number;
  /** Aumento anual esperado dos custos até a data da mudança (%). Aplicado na projeção. */
  costIncreasePctYear: number;
  fx: FxAssumptions;
  income: FutureIncome;
  notes: string;
  updatedAt: string;
}

export interface Household {
  adults: number;
  children: number;
  pets: number;
}

export interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  adults: number;
  children: number;
  childrenAges: string;
  pets: number;
  petDetails: string;
  familySituation: string;
  financialDependents: string;
}

export interface MovePlan {
  targetCity: string;
  otherCities: string;
  /** 'YYYY-MM' */
  targetMonth: string;
  dateFlexibility: 'fixa' | 'ate_3_meses' | 'ate_6_meses' | 'flexivel';
  goal: string;
  /** Via declarada pelo cliente. A aplicação NÃO avalia elegibilidade. */
  migrationRoute: string;
  documentationStatus: string;
  ticketsBought: boolean;
  needsTempLodging: boolean;
  housingIntent: HousingType;
}

export interface Finances {
  reserveBRL: number;
  reserveEUR: number;
  otherResourcesBRL: number;
  otherResourcesNote: string;
  /** Dinheiro atual que o cliente quer preservar para outras finalidades (excluído dos recursos). */
  preservedBRL: number;
  monthlyIncomeBRL: number;
  monthlyExpensesBRL: number;
  monthlyDebtBRL: number;
  savingsCapacityBRL: number;
  incomeAfterArrival: 'confirmada' | 'esperada' | 'nenhuma';
  incomeAfterArrivalNote: string;
  /** Reserva de segurança que o cliente quer manter intocada após a mudança. */
  safetyReserveBRL: number;
  /** Compromissos no Brasil que continuam após a mudança (parcelas, apoio a dependentes). */
  ongoingBrazilMonthlyBRL: number;
}

export interface SavingsPeriod {
  id: string;
  fromMonth: number; // índice 1..N
  toMonth: number;
  amount: number;
}

export interface CashEvent {
  id: string;
  month: number; // índice 1..N
  amount: number;
  description: string;
}

export interface SavingsPlan {
  /** Primeiro mês de poupança 'YYYY-MM'. */
  startMonth: string;
  periods: SavingsPeriod[];
  contributions: CashEvent[];
  extraExpenses: CashEvent[];
}

export type ChecklistStatus = 'pendente' | 'em_andamento' | 'concluida' | 'nao_aplicavel';

export interface ChecklistItem {
  id: string;
  group: string;
  title: string;
  detail: string;
  status: ChecklistStatus;
  requiresOfficialCheck: boolean;
  dueDate: string;
  note: string;
}

export interface ConsultantNotes {
  objectives: string;
  risks: string;
  decisions: string;
  pending: string;
  recommendations: string;
  nextSteps: string;
  general: string;
}

export interface Delivery {
  id: string;
  version: number;
  createdAt: string;
  label: string;
  snapshot: Omit<Client, 'deliveries'>;
}

export type ClientStatus = 'rascunho' | 'em_andamento' | 'entregue';

export interface Client {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ClientStatus;
  profile: ProfileKind;
  personal: PersonalInfo;
  move: MovePlan;
  finances: Finances;
  scenarios: Scenario[];
  selectedScenarioId: string;
  savingsPlan: SavingsPlan;
  checklist: ChecklistItem[];
  notes: ConsultantNotes;
  deliveries: Delivery[];
}

export interface Settings {
  productAPrice: number;
  productBPrice: number;
  /** Horas totais por consultoria (preparação + reunião + entrega), para o valor/hora efetivo. */
  consultationHours: number;
  consultantNames: string;
  /** Dias após os quais o câmbio é considerado desatualizado. */
  fxStaleDays: number;
  /** Dias após os quais um preço consultado é considerado antigo. */
  priceStaleDays: number;
  /** % máximo do custo de vida financiado coberto por renda futura antes de alertar. */
  incomeDependencyLimitPct: number;
  /** Câmbio padrão copiado para novos cenários. */
  defaultFx: FxAssumptions;
}
