import { ArrowLeft, Printer } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CostDistributionChart, SavingsEvolutionChart, ScenarioComparisonChart } from '../components/charts';
import { checklistProgress } from '../components/ChecklistEditor';
import { StatusBadge } from '../components/CostListEditor';
import GoalBreakdown from '../components/GoalBreakdown';
import { NOTE_FIELDS } from '../components/NotesEditor';
import { FxSensitivityTable, ScenarioComparisonTable } from '../components/tables';
import { AlertList, Badge, Button, cx } from '../components/ui';
import { analyze, compareScenarios } from '../domain/analysis';
import type { LineResult } from '../domain/calc';
import {
  CHECKLIST_STATUS_LABELS,
  FLEX_LABELS,
  HOUSING_LABELS,
  INCOME_AFTER_LABELS,
  LEVEL_LABELS,
  NATURE_LABELS,
  PROFILE_LABELS,
  SCALING_SHORT,
  STATUS_LABELS,
} from '../domain/labels';
import type { Client } from '../domain/types';
import { dateLabel, monthLabel, todayISO } from '../lib/dates';
import { money, pct } from '../lib/format';
import { executiveSummary, monthsToGoalText, reachedText, requiredMonthlyText } from '../lib/text';
import { useClient, useStore } from '../store/useStore';

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('mt-8', className)}>
      <h2 className="mb-3 border-b-2 border-verde-500 pb-1 text-lg font-semibold text-navy-900">{title}</h2>
      {children}
    </section>
  );
}

function CostTable({ lines, monthly }: { lines: LineResult[]; monthly?: boolean }) {
  return (
    <table className="data-table text-xs">
      <thead>
        <tr>
          <th>Item</th>
          {!monthly && <th>Natureza</th>}
          <th className="r">Unitário</th>
          <th className="r">Qtd.</th>
          <th className="r">Subtotal</th>
          <th className="r">Em R$</th>
          <th>Fonte / data</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.id} className={cx('avoid-break', l.alreadyPaid && 'text-navy-400')}>
            <td>
              <span className="font-medium">{l.name}</span>
              <span className="block text-[10px] text-navy-500">
                {l.categoryLabel}
                {l.alreadyPaid && ' · já pago (fora da meta)'}
              </span>
            </td>
            {!monthly && <td>{l.nature ? NATURE_LABELS[l.nature] : ''}</td>}
            <td className="r">{money(l.unitValue, l.currency, true)}</td>
            <td className="r whitespace-nowrap">
              {l.derived ? l.effectiveQty : `${l.quantity} ${SCALING_SHORT[l.scaling]}`}
            </td>
            <td className="r">{money(l.subtotal, l.currency)}</td>
            <td className="r">{money(l.subtotalBRL)}</td>
            <td>
              <StatusBadge status={l.status} consultedAt={l.consultedAt} />
              <span className="block text-[10px] text-navy-500">{l.derived && l.formula ? `${l.source || '—'} · ${l.formula}` : l.source || '—'}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ReportPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const live = useClient(id);
  const settings = useStore((s) => s.settings);
  const versionId = params.get('versao');
  const checklistOnly = params.get('modo') === 'checklist';

  const delivery = versionId ? live?.deliveries.find((d) => d.id === versionId) : undefined;
  const client: Client | undefined = delivery ? { ...delivery.snapshot, deliveries: [] } : live;
  const today = delivery ? delivery.createdAt.slice(0, 10) : todayISO();
  const analysis = useMemo(() => (client ? analyze(client, settings, today) : null), [client, settings, today]);
  const comparison = useMemo(() => (client ? compareScenarios(client) : []), [client]);

  if (!client || !analysis || (versionId && !delivery)) {
    return (
      <div className="p-10 text-center text-sm text-navy-600">
        Relatório não encontrado. <Link to="/" className="text-verde-700 underline">Voltar</Link>
      </div>
    );
  }

  const { plan, projection: p, scenario, alerts } = analysis;
  const m = plan.main;
  const ck = checklistProgress(client.checklist);
  const sources = [
    ...new Map(
      [...plan.oneTimeLines, ...plan.monthlyLines]
        .filter((l) => l.source.trim())
        .map((l) => [`${l.source}|${l.consultedAt}|${l.status}`, l] as const),
    ).values(),
  ];
  const groups = [...new Set(client.checklist.map((i) => i.group))];

  const toolbar = (
    <div className="no-print sticky top-0 z-10 border-b border-areia-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link to={`/clientes/${client.id}?aba=entrega`} className="inline-flex items-center gap-1 text-sm text-navy-600 hover:text-navy-900">
          <ArrowLeft className="h-4 w-4" /> Voltar ao cliente
        </Link>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-navy-500 sm:block">No diálogo de impressão, escolha “Salvar como PDF”.</p>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir / salvar PDF
          </Button>
        </div>
      </div>
    </div>
  );

  const header = (
    <header className="flex items-start justify-between gap-4 border-b border-areia-200 pb-5">
      <div>
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
            <rect width="32" height="32" rx="8" fill="#182a47" />
            <path d="M8 21l5-6 4 4 7-9" fill="none" stroke="#3db480" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-bold text-navy-900">Espanha Planejada</span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-navy-900">{checklistOnly ? 'Checklist da mudança' : 'Planejamento financeiro da mudança'}</h1>
        <p className="mt-1 text-sm text-navy-600">
          {client.personal.name || 'Cliente'} · {client.move.targetCity || 'cidade a definir'} · {monthLabel(client.move.targetMonth)}
        </p>
      </div>
      <div className="text-right text-xs text-navy-500">
        <p>{delivery ? `Versão ${delivery.version}${delivery.label ? ` — ${delivery.label}` : ''}` : 'Versão de trabalho (não final)'}</p>
        <p>Emitido em {dateLabel(today)}</p>
        {settings.consultantNames && <p>Consultoria: {settings.consultantNames}</p>}
      </div>
    </header>
  );

  const checklistBlock = (
    <>
      <p className="mb-3 text-sm text-navy-600">
        {ck.done} de {ck.total} tarefas aplicáveis concluídas. Tarefas marcadas como “fonte oficial” dependem de requisitos migratórios e devem ser
        confirmadas em fonte oficial; esta lista não define prazos legais.
      </p>
      {groups.map((g) => (
        <div key={g} className="avoid-break mb-4">
          <h3 className="mb-1 text-sm font-semibold text-navy-800">{g}</h3>
          <table className="data-table text-xs">
            <tbody>
              {client.checklist
                .filter((i) => i.group === g)
                .map((i) => (
                  <tr key={i.id}>
                    <td className="w-6">{i.status === 'concluida' ? '☑' : i.status === 'nao_aplicavel' ? '—' : '☐'}</td>
                    <td>
                      <span className="font-medium">{i.title}</span>
                      {i.requiresOfficialCheck && <span className="ml-1 text-[10px] font-semibold text-amber-700">(fonte oficial)</span>}
                      {i.note && <span className="block text-[10px] text-navy-500">{i.note}</span>}
                    </td>
                    <td className="w-24">{CHECKLIST_STATUS_LABELS[i.status]}</td>
                    <td className="w-20 text-right">{i.dueDate ? dateLabel(i.dueDate) : ''}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );

  if (checklistOnly) {
    return (
      <div className="min-h-screen bg-white">
        {toolbar}
        <main className="mx-auto max-w-4xl px-6 py-8">
          {header}
          <div className="mt-6">{checklistBlock}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {toolbar}
      <main className="mx-auto max-w-4xl px-6 py-8 text-navy-900">
        {header}

        {!plan.valid ? (
          <div className="mt-6">
            <AlertList alerts={alerts.filter((a) => a.severity === 'critico')} />
          </div>
        ) : (
          <>
            <Section title="Resumo">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Meta total', money(m.required.totalBRL)],
                  ['Disponível hoje', money(m.available.totalBRL)],
                  [m.shortfallBRL > 0 ? 'Falta juntar' : 'Acima da meta', money(m.shortfallBRL > 0 ? m.shortfallBRL : m.surplusBRL)],
                  ['Progresso', pct(m.progressPct)],
                  ['Custo de vida/mês', money(plan.monthlyLiving.totalBRL)],
                  ['Poupança p/ data pretendida', requiredMonthlyText(p)],
                  ['Meses até a meta', monthsToGoalText(p)],
                  ['Data projetada', reachedText(p)],
                ].map(([k, v]) => (
                  <div key={k} className="avoid-break rounded-lg border border-areia-200 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-navy-500">{k}</p>
                    <p className="mt-0.5 text-base font-semibold tabular-nums">{v}</p>
                  </div>
                ))}
              </div>
              <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-areia-50 p-4 font-sans text-xs leading-relaxed text-navy-800">
                {executiveSummary(client, analysis).split('\n').slice(2).join('\n')}
              </pre>
            </Section>

            <Section title="Perfil do cliente">
              <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                {[
                  ['Perfil', PROFILE_LABELS[client.profile]],
                  ['Composição', `${plan.household.adults} adulto(s), ${plan.household.children} criança(s)${client.personal.childrenAges ? ` (${client.personal.childrenAges})` : ''}, ${plan.household.pets} animal(is)`],
                  ['Cidade pretendida', client.move.targetCity || '—'],
                  ['Outras cidades', client.move.otherCities || '—'],
                  ['Data pretendida', `${monthLabel(client.move.targetMonth)} · ${FLEX_LABELS[client.move.dateFlexibility]}`],
                  ['Objetivo', client.move.goal || '—'],
                  ['Via migratória (declarada)', client.move.migrationRoute || '—'],
                  ['Documentação', client.move.documentationStatus || '—'],
                  ['Renda após a chegada', INCOME_AFTER_LABELS[client.finances.incomeAfterArrival]],
                  ['Dependentes financeiros', client.personal.financialDependents || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-areia-100 py-1">
                    <dt className="text-navy-500">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-navy-500">
                A via migratória é informação declarada pelo cliente. Este planejamento não avalia elegibilidade nem substitui a verificação dos requisitos
                oficiais.
              </p>
            </Section>

            <Section title="Como a meta foi calculada">
              <GoalBreakdown plan={plan} />
              <div className="avoid-break mt-4">
                <CostDistributionChart plan={plan} height={200} />
              </div>
            </Section>

            <Section title="Premissas utilizadas" className="print-break">
              <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                {[
                  ['Cenário', `${scenario.name} (${LEVEL_LABELS[scenario.level]})`],
                  ['Moradia', HOUSING_LABELS[scenario.housing.type]],
                  ['Aluguel mensal', money(scenario.housing.monthlyRent, scenario.housing.currency)],
                  ['Caução / comissão / antecipado', `${scenario.housing.depositMonths} / ${scenario.housing.agencyFeeMonths} / ${scenario.housing.advanceRentMonths} mês(es)`],
                  ['Custo de vida financiado', `${scenario.runwayMonths} meses`],
                  ['Reserva de emergência', scenario.emergency.mode === 'meses' ? `${scenario.emergency.months} meses de custo de vida` : money(scenario.emergency.valueBRL)],
                  ['Margem para imprevistos', `${scenario.contingencyPct}%`],
                  ['Aumento anual de custos', `${scenario.costIncreasePctYear}% a.a.`],
                  ['Câmbio', `R$ ${scenario.fx.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por € (${dateLabel(scenario.fx.quotedAt)})`],
                  ['Fonte do câmbio', scenario.fx.source || '—'],
                  ['Custo de conversão', `${scenario.fx.conversionCostPct}% → R$ ${plan.rates.buyRate.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} por €`],
                  [
                    'Renda futura',
                    scenario.income.monthlyAmount > 0
                      ? `${money(scenario.income.monthlyAmount, scenario.income.currency)}/mês a partir do mês ${scenario.income.startMonth} · ${scenario.income.confirmed ? 'confirmada' : 'não confirmada'} · ${plan.incomeIncluded ? 'incluída na meta' : 'fora da meta'}`
                      : 'Não considerada',
                  ],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-areia-100 py-1">
                    <dt className="text-navy-500">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section title="Custos únicos da mudança">
              <CostTable lines={plan.oneTimeLines} />
            </Section>

            <Section title="Custo de vida mensal estimado">
              <CostTable lines={plan.monthlyLines} monthly />
              <p className="mt-2 text-right text-sm font-semibold">
                Total mensal: {money(plan.monthlyLiving.totalBRL)} ({money(plan.monthlyLiving.eur, 'EUR')} + {money(plan.monthlyLiving.brl)})
              </p>
            </Section>

            <Section title="Recursos disponíveis">
              <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                {[
                  ['Reserva em reais', money(client.finances.reserveBRL)],
                  ['Reserva em euros', money(client.finances.reserveEUR, 'EUR')],
                  ['Outros recursos', `${money(client.finances.otherResourcesBRL)}${client.finances.otherResourcesNote ? ` (${client.finances.otherResourcesNote})` : ''}`],
                  ['Preservado para outras finalidades', `− ${money(m.available.preservedBRL)}`],
                  ['Total destinado à mudança (R$ equivalentes)', money(m.available.totalBRL)],
                  ['Poupança mensal informada', money(client.finances.savingsCapacityBRL)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-areia-100 py-1">
                    <dt className="text-navy-500">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section title="Plano de economia" className="print-break">
              <div className="avoid-break">
                <SavingsEvolutionChart projection={p} targetMonth={client.move.targetMonth} height={220} />
              </div>
              <table className="data-table mt-3 text-[11px]">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th className="r">Saldo inicial</th>
                    <th className="r">Poupança</th>
                    <th className="r">Extra (+/−)</th>
                    <th className="r">Saldo acumulado</th>
                    <th className="r">Meta</th>
                    <th className="r">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {p.rows.map((r) => (
                    <tr key={r.index} className={cx(p.monthsToGoal === r.index && 'bg-verde-50 font-semibold', r.month === client.move.targetMonth && 'bg-terra-50')}>
                      <td>{monthLabel(r.month)}</td>
                      <td className="r">{money(r.opening)}</td>
                      <td className="r">{money(r.savings)}</td>
                      <td className="r">{r.contributions - r.extraExpenses ? money(r.contributions - r.extraExpenses) : '—'}</td>
                      <td className="r">{money(r.closing)}</td>
                      <td className="r">{money(r.goal)}</td>
                      <td className={cx('r', r.gap >= 0 ? 'text-verde-700' : 'text-terra-700')}>{money(r.gap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[10px] text-navy-500">Sem rendimentos de investimento. Verde: mês em que a meta é atingida. Laranja: mês pretendido para a mudança.</p>
            </Section>

            <Section title="Comparação de cenários" className="print-break">
              <div className="avoid-break">
                <ScenarioComparisonChart items={comparison.filter((c) => c.plan.valid)} height={220} />
              </div>
              <div className="mt-3 text-xs">
                <ScenarioComparisonTable items={comparison} selectedId={scenario.id} />
              </div>
            </Section>

            <Section title="Sensibilidade ao câmbio">
              <div className="text-xs">
                <FxSensitivityTable client={client} scenario={scenario} plan={plan} />
              </div>
            </Section>

            <Section title="Pontos de atenção">
              <AlertList alerts={alerts} />
            </Section>
          </>
        )}

        <Section title="Observações da consultoria" className="print-break">
          {NOTE_FIELDS.filter((f) => f.key !== 'general').map((f) => (
            <div key={f.key} className="avoid-break mb-3">
              <h3 className="text-sm font-semibold text-navy-800">{f.label}</h3>
              <p className="whitespace-pre-wrap text-sm text-navy-700">{client.notes[f.key] || '—'}</p>
            </div>
          ))}
        </Section>

        <Section title="Checklist da mudança">{checklistBlock}</Section>

        <Section title="Fontes e datas dos preços">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Data da consulta</th>
                <th>Situação</th>
                <th>Exemplo de item</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{scenario.fx.source || '—'} (câmbio)</td>
                <td>{dateLabel(scenario.fx.quotedAt)}</td>
                <td>—</td>
                <td>Câmbio R$/€</td>
              </tr>
              {sources.map((l) => (
                <tr key={`${l.source}${l.consultedAt}${l.status}`}>
                  <td>{l.source}</td>
                  <td>{dateLabel(l.consultedAt)}</td>
                  <td>
                    <Badge tone={l.status === 'confirmado' ? 'green' : l.status === 'estimado' ? 'navy' : 'warn'}>{STATUS_LABELS[l.status]}</Badge>
                  </td>
                  <td>{l.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Limitações">
          <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-navy-700">
            <li>Os valores são estimativas baseadas nas fontes e datas indicadas. Itens “sem cotação” são pontos de partida e não refletem preços atuais.</li>
            <li>O câmbio varia diariamente; a meta em reais muda com ele. A tabela de sensibilidade mostra o efeito de variações.</li>
            <li>A projeção de poupança não considera rendimentos de investimentos, inflação no Brasil ou variação de renda não informada.</li>
            <li>Atingir a meta matemática não garante um plano seguro.</li>
            <li>
              Este documento não é assessoria jurídica ou migratória e não garante aprovação de vistos, emprego ou aluguel. Requisitos, valores exigidos e
              prazos oficiais devem ser verificados individualmente em fonte oficial.
            </li>
          </ul>
        </Section>
      </main>
    </div>
  );
}
