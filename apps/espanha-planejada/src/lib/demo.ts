// Clientes de exemplo para demonstração e treino. Todos os valores são ilustrativos.

import { addMonths, currentMonth } from './dates';
import { newClient, rebuildScenariosFor, buildChecklist } from '../domain/templates';
import type { Client, Settings } from '../domain/types';

const DEMO_FX = {
  rate: 6.3,
  quotedAt: '2026-01-15',
  source: 'Exemplo ilustrativo (não é cotação) — atualize',
  conversionCostPct: 4,
};

function finalize(c: Client): Client {
  c.scenarios = rebuildScenariosFor(c, DEMO_FX);
  c.selectedScenarioId = c.scenarios[1].id;
  c.checklist = buildChecklist({
    children: c.personal.children,
    pets: c.personal.pets,
    ticketsBought: c.move.ticketsBought,
    needsTempLodging: c.move.needsTempLodging,
  });
  c.move.housingIntent = c.scenarios[1].housing.type;
  return c;
}

export function buildDemoClients(settings: Settings, now = new Date()): Client[] {
  const start = addMonths(currentMonth(now), 1);

  const ana = newClient('sozinho', settings, now);
  ana.status = 'em_andamento';
  ana.personal = { ...ana.personal, name: 'Exemplo — Ana (pessoa sozinha)', adults: 1, children: 0 };
  ana.move = {
    ...ana.move,
    targetCity: 'Valência',
    otherCities: 'Alicante',
    targetMonth: addMonths(start, 8),
    goal: 'Mestrado e depois trabalho na área de marketing.',
    migrationRoute: 'Visto de estudante (declarado pela cliente)',
    documentationStatus: 'Passaporte válido; certidões ainda não emitidas.',
  };
  ana.finances = {
    ...ana.finances,
    reserveBRL: 60000,
    monthlyIncomeBRL: 7000,
    monthlyExpensesBRL: 4000,
    monthlyDebtBRL: 500,
    savingsCapacityBRL: 2500,
    incomeAfterArrival: 'nenhuma',
    safetyReserveBRL: 10000,
  };
  finalize(ana);

  const casal = newClient('casal', settings, now);
  casal.status = 'em_andamento';
  casal.personal = { ...casal.personal, name: 'Exemplo — Bruno e Carla (casal)', adults: 2, children: 0 };
  casal.move = {
    ...casal.move,
    targetCity: 'Madri',
    otherCities: 'Barcelona, Valência',
    targetMonth: addMonths(start, 12),
    goal: 'Trabalho remoto do Bruno e recolocação da Carla.',
    migrationRoute: 'Nômade digital (declarado pelo casal)',
    documentationStatus: 'Levantando documentos.',
  };
  casal.finances = {
    ...casal.finances,
    reserveBRL: 30000,
    reserveEUR: 2000,
    preservedBRL: 5000,
    monthlyIncomeBRL: 14000,
    monthlyExpensesBRL: 9500,
    monthlyDebtBRL: 1000,
    savingsCapacityBRL: 3000,
    incomeAfterArrival: 'esperada',
    incomeAfterArrivalNote: 'Bruno espera manter contrato remoto; ainda sem confirmação formal.',
    safetyReserveBRL: 15000,
    ongoingBrazilMonthlyBRL: 400,
  };
  finalize(casal);
  for (const sc of casal.scenarios) {
    sc.income = { description: 'Trabalho remoto do Bruno', monthlyAmount: 1800, currency: 'EUR', startMonth: 2, confirmed: false, includeInGoal: false };
  }

  const familia = newClient('familia', settings, now);
  familia.status = 'rascunho';
  familia.personal = {
    ...familia.personal,
    name: 'Exemplo — Família Duarte',
    adults: 2,
    children: 2,
    childrenAges: '6 e 9 anos',
    pets: 1,
    petDetails: 'Cachorro de porte médio',
    financialDependents: 'Ajuda mensal à mãe da Daniela',
  };
  familia.move = {
    ...familia.move,
    targetCity: 'Málaga',
    targetMonth: addMonths(start, 18),
    dateFlexibility: 'flexivel',
    goal: 'Qualidade de vida e educação dos filhos.',
    migrationRoute: 'Ainda não definida',
  };
  familia.finances = {
    ...familia.finances,
    reserveBRL: 40000,
    monthlyIncomeBRL: 16000,
    monthlyExpensesBRL: 14500,
    monthlyDebtBRL: 1500,
    savingsCapacityBRL: 0,
    incomeAfterArrival: 'nenhuma',
    safetyReserveBRL: 20000,
    ongoingBrazilMonthlyBRL: 600,
  };
  finalize(familia);

  return [ana, casal, familia];
}
