// Exportações: Excel (.xlsx via exceljs, carregado sob demanda), CSV e texto.

import { compareScenarios, type Analysis } from '../domain/analysis';
import type { LineResult } from '../domain/calc';
import {
  CHECKLIST_STATUS_LABELS,
  HOUSING_LABELS,
  LEVEL_LABELS,
  NATURE_LABELS,
  PROFILE_LABELS,
  SCALING_SHORT,
  STATUS_LABELS,
} from '../domain/labels';
import type { Client } from '../domain/types';
import { NOTE_FIELDS } from '../components/NotesEditor';
import { dateLabel, monthLabel } from './dates';
import { downloadBlob, downloadText, slug } from './download';
import { executiveSummary, monthsToGoalText, reachedText } from './text';

// ---------- CSV ----------

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? v.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 2 }) : '';
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV no padrão do Excel brasileiro: separador ';', vírgula decimal e BOM UTF-8. */
export function toCSV(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
}

function costRows(lines: LineResult[], kind: 'Único' | 'Mensal', scenarioName: string): unknown[][] {
  return lines.map((l) => [
    scenarioName,
    kind,
    l.categoryLabel,
    l.name,
    l.nature ? NATURE_LABELS[l.nature] : 'Recorrente',
    l.currency,
    l.unitValue,
    l.quantity,
    SCALING_SHORT[l.scaling],
    l.effectiveQty,
    l.subtotal,
    l.subtotalBRL,
    l.alreadyPaid ? 'Sim' : 'Não',
    STATUS_LABELS[l.status],
    l.source,
    l.consultedAt ? dateLabel(l.consultedAt) : '',
    l.derived ? `Calculado: ${l.formula ?? ''}` : l.note,
  ]);
}

const COST_HEADER = [
  'Cenário', 'Tipo', 'Categoria', 'Item', 'Natureza', 'Moeda', 'Valor unitário', 'Quantidade', 'Multiplicador', 'Qtd. efetiva',
  'Subtotal (moeda)', 'Subtotal (R$)', 'Já pago', 'Situação', 'Fonte', 'Data da consulta', 'Observação',
];

export function exportCostsCSV(client: Client): void {
  const rows: unknown[][] = [COST_HEADER];
  for (const c of compareScenarios(client)) {
    rows.push(...costRows(c.plan.oneTimeLines, 'Único', c.scenario.name), ...costRows(c.plan.monthlyLines, 'Mensal', c.scenario.name));
  }
  downloadText(`${slug(client.personal.name)}-custos.csv`, toCSV(rows), 'text/csv;charset=utf-8');
}

export function exportProjectionCSV(client: Client, a: Analysis): void {
  const rows: unknown[][] = [['Mês', 'Referência', 'Saldo inicial', 'Poupança planejada', 'Aportes', 'Despesas extraordinárias', 'Saldo acumulado', 'Meta', 'Diferença']];
  for (const r of a.projection.rows) rows.push([r.index, monthLabel(r.month), r.opening, r.savings, r.contributions, r.extraExpenses, r.closing, r.goal, r.gap]);
  downloadText(`${slug(client.personal.name)}-plano-de-poupanca.csv`, toCSV(rows), 'text/csv;charset=utf-8');
}

export function exportChecklistCSV(client: Client): void {
  const rows: unknown[][] = [['Grupo', 'Tarefa', 'Detalhe', 'Status', 'Verificar em fonte oficial', 'Data-alvo', 'Observação']];
  for (const i of client.checklist) {
    rows.push([i.group, i.title, i.detail, CHECKLIST_STATUS_LABELS[i.status], i.requiresOfficialCheck ? 'Sim' : 'Não', i.dueDate ? dateLabel(i.dueDate) : '', i.note]);
  }
  downloadText(`${slug(client.personal.name)}-checklist.csv`, toCSV(rows), 'text/csv;charset=utf-8');
}

export function exportSummaryTXT(client: Client, a: Analysis): void {
  downloadText(`${slug(client.personal.name)}-resumo-executivo.txt`, executiveSummary(client, a));
}

// ---------- Excel ----------

const NAVY = 'FF182A47';
const BRL_FMT = '"R$" #,##0.00';
const EUR_FMT = '"€" #,##0.00';

export async function exportExcel(client: Client, a: Analysis): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Espanha Planejada';
  wb.created = new Date();
  const { plan, projection: p, scenario } = a;
  const m = plan.main;

  type Sheet = ReturnType<typeof wb.addWorksheet>;
  const header = (ws: Sheet, row: number) => {
    const r = ws.getRow(row);
    r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    r.alignment = { vertical: 'middle', wrapText: true };
  };
  const title = (ws: Sheet, text: string) => {
    ws.addRow([text]).font = { bold: true, size: 14, color: { argb: NAVY } };
    ws.addRow([`Cliente: ${client.personal.name || '—'} · Cenário: ${scenario.name} · Gerado em ${new Date().toLocaleString('pt-BR')}`]).font = { italic: true, color: { argb: 'FF5579AD' } };
    ws.addRow([]);
  };

  // Resumo
  const resumo = wb.addWorksheet('Resumo');
  title(resumo, 'Espanha Planejada — Resumo do planejamento');
  resumo.columns = [{ width: 46 }, { width: 22 }, { width: 22 }, { width: 22 }];
  resumo.addRow(['Componente', 'Em euros', 'Em reais', 'Total em R$']);
  header(resumo, resumo.rowCount);
  const comp: [string, { eur: number; brl: number; totalBRL: number }][] = [
    ['Custos únicos definitivos', m.oneTimeDefinitive],
    ['Depósitos e cauções (potencialmente reembolsáveis)', m.deposits],
    [`Custo de vida financiado (${plan.runwayMonths} meses, bruto)`, m.runwayGross],
    ['(−) Renda futura considerada', { eur: -m.incomeOffset.eur, brl: -m.incomeOffset.brl, totalBRL: -m.incomeOffset.totalBRL }],
    ['Margem para imprevistos', m.contingency],
    ['Reserva de emergência (permanece disponível)', m.emergency],
    ['META TOTAL DE RECURSOS', m.required],
  ];
  for (const [label, v] of comp) {
    const r = resumo.addRow([label, v.eur, v.brl, v.totalBRL]);
    r.getCell(2).numFmt = EUR_FMT;
    r.getCell(3).numFmt = BRL_FMT;
    r.getCell(4).numFmt = BRL_FMT;
    if (label.startsWith('META')) r.font = { bold: true };
  }
  resumo.addRow([]);
  const kv: [string, unknown, string?][] = [
    ['Recursos destinados à mudança', m.available.totalBRL, BRL_FMT],
    ['Valor preservado (excluído)', m.available.preservedBRL, BRL_FMT],
    ['Valor que falta juntar', m.shortfallBRL, BRL_FMT],
    ['Progresso', m.progressPct / 100, '0.0%'],
    ['Custo de vida mensal (R$)', plan.monthlyLiving.totalBRL, BRL_FMT],
    ['Poupança mensal informada', p.baseSavings, BRL_FMT],
    ['Poupança mensal necessária p/ data pretendida', p.requiredMonthlyToMove ?? '—', BRL_FMT],
    ['Meses até a meta', monthsToGoalText(p)],
    ['Data projetada da meta', reachedText(p)],
    ['Data pretendida da mudança', monthLabel(client.move.targetMonth)],
    ['Câmbio (R$/€)', plan.rates.rate, '0.0000'],
    ['Câmbio efetivo de compra (R$/€)', plan.rates.buyRate, '0.0000'],
    ['Impacto de +R$ 0,10 no euro', plan.fxImpactPer10Cents, BRL_FMT],
  ];
  for (const [k, v, fmt] of kv) {
    const r = resumo.addRow([k, v]);
    r.getCell(1).font = { bold: true };
    if (fmt && typeof v === 'number') r.getCell(2).numFmt = fmt;
  }
  resumo.addRow([]);
  resumo.addRow(['Atingir a meta matemática não garante um plano seguro. Valores são estimativas com as fontes indicadas; requisitos migratórios devem ser verificados em fonte oficial.']).font = {
    italic: true,
    color: { argb: 'FF863F1E' },
  };

  // Premissas
  const prem = wb.addWorksheet('Premissas');
  title(prem, 'Premissas do cenário');
  prem.columns = [{ width: 44 }, { width: 40 }];
  const premRows: [string, unknown][] = [
    ['Perfil', PROFILE_LABELS[client.profile]],
    ['Adultos / crianças / animais', `${plan.household.adults} / ${plan.household.children} / ${plan.household.pets}`],
    ['Cidade pretendida', client.move.targetCity],
    ['Via migratória declarada (não avaliada)', client.move.migrationRoute],
    ['Cenário', `${scenario.name} (${LEVEL_LABELS[scenario.level]})`],
    ['Tipo de moradia', HOUSING_LABELS[scenario.housing.type]],
    ['Aluguel mensal', `${scenario.housing.monthlyRent} ${scenario.housing.currency}`],
    ['Caução (meses)', scenario.housing.depositMonths],
    ['Comissão (meses)', scenario.housing.agencyFeeMonths],
    ['Aluguel antecipado (meses)', scenario.housing.advanceRentMonths],
    ['Meses de custo de vida financiados', scenario.runwayMonths],
    ['Reserva de emergência', scenario.emergency.mode === 'meses' ? `${scenario.emergency.months} meses de custo de vida` : `R$ ${scenario.emergency.valueBRL}`],
    ['Margem para imprevistos (%)', scenario.contingencyPct],
    ['Aumento anual de custos (%)', scenario.costIncreasePctYear],
    ['Câmbio (R$/€)', scenario.fx.rate],
    ['Data / fonte do câmbio', `${dateLabel(scenario.fx.quotedAt)} · ${scenario.fx.source || '—'}`],
    ['Custo de conversão (%)', scenario.fx.conversionCostPct],
    ['Renda futura', scenario.income.monthlyAmount > 0 ? `${scenario.income.monthlyAmount} ${scenario.income.currency}/mês a partir do mês ${scenario.income.startMonth}` : 'Não considerada'],
    ['Renda confirmada', scenario.income.confirmed ? 'Sim' : 'Não'],
    ['Renda incluída na meta', plan.incomeIncluded ? 'Sim' : 'Não'],
  ];
  for (const r of premRows) prem.addRow(r).getCell(1).font = { bold: true };

  // Custos
  const addCostSheet = (name: string, lines: LineResult[], kind: 'Único' | 'Mensal') => {
    const ws = wb.addWorksheet(name);
    title(ws, name);
    ws.addRow(COST_HEADER.slice(1));
    header(ws, ws.rowCount);
    ws.columns = [10, 24, 36, 20, 8, 14, 10, 12, 10, 16, 16, 9, 13, 30, 14, 40].map((w) => ({ width: w }));
    const first = ws.rowCount + 1;
    for (const row of costRows(lines, kind, scenario.name)) {
      const r = ws.addRow(row.slice(1));
      r.getCell(6).numFmt = row[5] === 'EUR' ? EUR_FMT : BRL_FMT;
      r.getCell(10).numFmt = row[5] === 'EUR' ? EUR_FMT : BRL_FMT;
      r.getCell(11).numFmt = BRL_FMT;
    }
    const last = ws.rowCount;
    const total = ws.addRow(['', '', 'Soma das linhas em R$ (inclui depósitos e itens já pagos — a meta está no Resumo)', '', '', '', '', '', '', '', { formula: `SUM(K${first}:K${last})`, result: lines.reduce((s, l) => s + l.subtotalBRL, 0) }]);
    total.font = { bold: true };
    total.getCell(11).numFmt = BRL_FMT;
    ws.views = [{ state: 'frozen', ySplit: first - 1 }];
  };
  addCostSheet('Custos únicos', plan.oneTimeLines, 'Único');
  addCostSheet('Custo de vida mensal', plan.monthlyLines, 'Mensal');

  // Projeção
  const proj = wb.addWorksheet('Plano de poupança');
  title(proj, 'Plano de poupança (sem rendimentos de investimento)');
  proj.addRow(['Mês', 'Referência', 'Saldo inicial', 'Poupança planejada', 'Aportes', 'Despesas extraordinárias', 'Saldo acumulado', 'Meta', 'Diferença']);
  header(proj, proj.rowCount);
  proj.columns = [6, 12, 16, 16, 14, 16, 16, 16, 16].map((w) => ({ width: w }));
  for (const r of p.rows) {
    const row = proj.addRow([r.index, monthLabel(r.month), r.opening, r.savings, r.contributions, r.extraExpenses, r.closing, r.goal, r.gap]);
    for (let c = 3; c <= 9; c++) row.getCell(c).numFmt = BRL_FMT;
  }

  // Cenários
  const cmp = wb.addWorksheet('Comparação de cenários');
  title(cmp, 'Comparação de cenários');
  const items = compareScenarios(client);
  cmp.addRow(['Indicador', ...items.map((i) => i.scenario.name)]);
  header(cmp, cmp.rowCount);
  cmp.columns = [{ width: 34 }, ...items.map(() => ({ width: 20 }))];
  const cmpRows: [string, (i: (typeof items)[number]) => unknown, boolean?][] = [
    ['Moradia', (i) => HOUSING_LABELS[i.scenario.housing.type]],
    ['Custo de vida mensal (R$)', (i) => i.plan.monthlyLiving.totalBRL, true],
    ['Meses financiados', (i) => i.plan.runwayMonths],
    ['Custos únicos definitivos', (i) => i.plan.main.oneTimeDefinitive.totalBRL, true],
    ['Depósitos', (i) => i.plan.main.deposits.totalBRL, true],
    ['Margem para imprevistos', (i) => i.plan.main.contingency.totalBRL, true],
    ['Reserva de emergência', (i) => i.plan.main.emergency.totalBRL, true],
    ['Meta total', (i) => i.plan.main.required.totalBRL, true],
    ['Falta juntar', (i) => i.plan.main.shortfallBRL, true],
    ['Meses até a meta', (i) => monthsToGoalText(i.projection)],
    ['Data projetada', (i) => reachedText(i.projection)],
  ];
  for (const [label, fn, isMoney] of cmpRows) {
    const r = cmp.addRow([label, ...items.map(fn)]);
    if (isMoney) for (let c = 2; c <= items.length + 1; c++) r.getCell(c).numFmt = BRL_FMT;
  }

  // Checklist
  const ck = wb.addWorksheet('Checklist');
  title(ck, 'Checklist da mudança');
  ck.addRow(['Grupo', 'Tarefa', 'Status', 'Verificar em fonte oficial', 'Data-alvo', 'Observação']);
  header(ck, ck.rowCount);
  ck.columns = [26, 56, 14, 14, 12, 40].map((w) => ({ width: w }));
  for (const i of client.checklist) ck.addRow([i.group, i.title, CHECKLIST_STATUS_LABELS[i.status], i.requiresOfficialCheck ? 'Sim' : 'Não', i.dueDate ? dateLabel(i.dueDate) : '', i.note]);

  // Anotações
  const notes = wb.addWorksheet('Anotações');
  title(notes, 'Anotações da consultoria');
  notes.columns = [{ width: 36 }, { width: 90 }];
  for (const f of NOTE_FIELDS.filter((x) => x.key !== 'general')) {
    const r = notes.addRow([f.label, client.notes[f.key] || '—']);
    r.getCell(1).font = { bold: true };
    r.alignment = { wrapText: true, vertical: 'top' };
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(`${slug(client.personal.name)}-espanha-planejada.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
