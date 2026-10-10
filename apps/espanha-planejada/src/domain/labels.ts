import type {
  ChecklistStatus,
  ClientStatus,
  HousingType,
  MonthlyCategory,
  MovePlan,
  OneTimeCategory,
  OneTimeNature,
  ProfileKind,
  Scaling,
  ScenarioLevel,
  ValueStatus,
} from './types';

export const HOUSING_LABELS: Record<HousingType, string> = {
  quarto_compartilhado: 'Quarto em apartamento compartilhado',
  apartamento_compartilhado: 'Apartamento dividido (sua parte)',
  apartamento_independente: 'Apartamento independente',
  moradia_familiar: 'Moradia familiar (2+ quartos)',
};

export const HOUSING_HINTS: Record<HousingType, string> = {
  quarto_compartilhado: 'Aluga-se um quarto; cozinha e sala são divididas com outros moradores.',
  apartamento_compartilhado: 'Apartamento inteiro dividido com outra pessoa ou família. Informe só a sua parte do aluguel.',
  apartamento_independente: 'Estúdio ou apartamento de 1 quarto só para você/vocês.',
  moradia_familiar: 'Apartamento ou casa com 2 ou mais quartos para a família.',
};

export const LEVEL_LABELS: Record<ScenarioLevel, string> = {
  economico: 'Econômico',
  intermediario: 'Intermediário',
  conservador: 'Conservador',
  personalizado: 'Personalizado',
};

export const LEVEL_HINTS: Record<ScenarioLevel, string> = {
  economico: 'Escolhas mais baratas e viáveis: moradia simples, menos meses financiados.',
  intermediario: 'Orçamento equilibrado entre conforto e economia.',
  conservador: 'Custos mais altos e maior margem de segurança.',
  personalizado: 'Cenário ajustado manualmente.',
};

export const PROFILE_LABELS: Record<ProfileKind, string> = {
  sozinho: 'Pessoa sozinha',
  casal: 'Casal',
  familia: 'Família com filhos',
};

export const SCALING_LABELS: Record<Scaling, string> = {
  fixo: 'Fixo (não depende do nº de pessoas)',
  por_adulto: 'Por adulto',
  por_crianca: 'Por criança',
  por_pessoa: 'Por pessoa',
  por_animal: 'Por animal',
};

export const SCALING_SHORT: Record<Scaling, string> = {
  fixo: 'fixo',
  por_adulto: '× adultos',
  por_crianca: '× crianças',
  por_pessoa: '× pessoas',
  por_animal: '× animais',
};

export const STATUS_LABELS: Record<ValueStatus, string> = {
  confirmado: 'Confirmado',
  estimado: 'Estimado',
  sem_cotacao: 'Sem cotação',
};

export const NATURE_LABELS: Record<OneTimeNature, string> = {
  definitivo: 'Gasto definitivo',
  reembolsavel: 'Depósito reembolsável',
};

export const ONE_TIME_CATEGORY_LABELS: Record<OneTimeCategory, string> = {
  passagens: 'Passagens aéreas',
  bagagem: 'Bagagem',
  documentacao: 'Documentação',
  apostilamento_traducao: 'Apostilamentos e traduções',
  taxas_administrativas: 'Taxas administrativas',
  seguro_inicial: 'Seguro / cobertura inicial',
  hospedagem_temporaria: 'Hospedagem temporária',
  transporte_local: 'Transporte local inicial',
  instalacao: 'Instalação e utensílios',
  animais: 'Transporte de animais',
  deposito_outros: 'Outros depósitos',
  outros: 'Outros custos',
};

export const MONTHLY_CATEGORY_LABELS: Record<MonthlyCategory, string> = {
  utilidades: 'Eletricidade, água e gás',
  internet_telefone: 'Internet e telefone',
  supermercado: 'Supermercado',
  transporte: 'Transporte',
  saude_seguros: 'Saúde e seguros',
  educacao: 'Educação e mensalidades',
  criancas: 'Despesas com crianças',
  animais: 'Despesas com animais',
  lazer: 'Lazer',
  pessoais: 'Despesas pessoais',
  compromissos_brasil: 'Compromissos que continuam no Brasil',
  outros: 'Outros recorrentes',
};

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  nao_aplicavel: 'Não se aplica',
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  rascunho: 'Rascunho',
  em_andamento: 'Em andamento',
  entregue: 'Entregue',
};

export const FLEX_LABELS: Record<MovePlan['dateFlexibility'], string> = {
  fixa: 'Data fixa',
  ate_3_meses: 'Pode adiar até 3 meses',
  ate_6_meses: 'Pode adiar até 6 meses',
  flexivel: 'Totalmente flexível',
};

export const INCOME_AFTER_LABELS = {
  confirmada: 'Confirmada (contrato/proposta formal)',
  esperada: 'Apenas esperada',
  nenhuma: 'Nenhuma prevista',
} as const;
