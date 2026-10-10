import { useMemo } from 'react';
import { compareScenarios, type Analysis } from '../domain/analysis';
import { HOUSING_LABELS, LEVEL_LABELS } from '../domain/labels';
import type { Client } from '../domain/types';
import { money, pct } from '../lib/format';
import { monthsToGoalText, reachedText, requiredMonthlyText } from '../lib/text';
import { CostDistributionChart, GoalVsReserveChart, MonthlyBreakdownChart, SavingsEvolutionChart, ScenarioComparisonChart } from './charts';
import GoalBreakdown from './GoalBreakdown';
import { FxSensitivityTable, ScenarioComparisonTable } from './tables';
import { AlertList, Button, Card, ProgressBar, Stat } from './ui';

export default function Dashboard({ client, analysis, onNavigate }: { client: Client; analysis: Analysis; onNavigate: (tab: string) => void }) {
  const { plan, projection: p, scenario, alerts } = analysis;
  const m = plan.main;
  const comparison = useMemo(() => compareScenarios(client), [client]);

  if (!plan.valid) {
    return (
      <Card title="Faltam dados para calcular">
        <AlertList alerts={alerts.filter((a) => a.severity === 'critico')} />
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={() => onNavigate('cenarios')}>
            Ajustar premissas do cenário
          </Button>
          <Button onClick={() => onNavigate('cadastro')}>Revisar cadastro</Button>
        </div>
      </Card>
    );
  }

  const savings = p.baseSavings;
  const savingsTone = p.requiredMonthlyToMove !== null && p.requiredMonthlyToMove > savings ? 'danger' : 'default';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-navy-900 p-6 text-white lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-navy-200">Custo estimado da mudança · meta total</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums">{money(m.required.totalBRL)}</p>
              <p className="mt-1 text-sm text-navy-200">
                Cenário {scenario.name}
                {scenario.level !== 'personalizado' && scenario.name !== LEVEL_LABELS[scenario.level] ? ` (${LEVEL_LABELS[scenario.level]})` : ''} ·{' '}
                {HOUSING_LABELS[scenario.housing.type]}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-navy-200">{m.shortfallBRL > 0 ? 'Falta juntar' : 'Acima da meta'}</p>
              <p className={m.shortfallBRL > 0 ? 'text-2xl font-semibold text-terra-400' : 'text-2xl font-semibold text-verde-300'}>
                {money(m.shortfallBRL > 0 ? m.shortfallBRL : m.surplusBRL)}
              </p>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex justify-between text-xs text-navy-200">
              <span>Progresso financeiro: {money(m.available.totalBRL)} disponíveis</span>
              <span className="font-semibold text-white">{pct(m.progressPct)}</span>
            </div>
            <ProgressBar value={m.progressPct} className="mt-2 bg-navy-700" />
          </div>
        </div>
        <Card title="Alertas" className="lg:row-span-2" subtitle="Ordenados por gravidade">
          <div className="max-h-[520px] overflow-auto pr-1">
            <AlertList alerts={alerts} />
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-3">
          <Stat label="Meta mensal de poupança" value={requiredMonthlyText(p)} sub={`Capacidade informada: ${money(savings)}/mês`} tone={savingsTone} help="Quanto poupar por mês para atingir a meta na data pretendida." />
          <Stat label="Meses até a meta" value={monthsToGoalText(p)} sub={`Com ${money(savings)}/mês`} tone={p.unreachable ? 'danger' : 'default'} />
          <Stat label="Data projetada" value={reachedText(p)} sub={`Pretendida: ${client.move.targetMonth ? client.move.targetMonth.split('-').reverse().join('/') : '—'}`} />
          <Stat label="Custo de vida mensal" value={money(plan.monthlyLiving.totalBRL)} sub={`${money(plan.monthlyLiving.eur, 'EUR')} + ${money(plan.monthlyLiving.brl)}`} />
          <Stat label="Custos únicos" value={money(m.oneTimeDefinitive.totalBRL)} sub="Gastos definitivos" />
          <Stat label="Depósitos e cauções" value={money(m.deposits.totalBRL)} sub="Potencialmente reembolsáveis" />
          <Stat label="Reserva de emergência" value={money(m.emergency.totalBRL)} sub="Permanece disponível" tone="green" />
          <Stat label="Dinheiro disponível" value={money(m.available.totalBRL)} sub={m.available.preservedBRL ? `Após preservar ${money(m.available.preservedBRL)}` : 'Destinado à mudança'} />
          <Stat label="Câmbio do cenário" value={`R$ ${plan.rates.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} sub={`+R$ 0,10 no euro = +${money(plan.fxImpactPer10Cents)}`} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Como a meta é formada" subtitle="Despesas, depósitos recuperáveis e dinheiro que permanece disponível, separados.">
          <GoalBreakdown plan={plan} />
        </Card>
        <div className="flex flex-col gap-6">
          <Card title="Distribuição dos custos">
            <CostDistributionChart plan={plan} />
          </Card>
          <Card title="Meta x recursos atuais">
            <GoalVsReserveChart plan={plan} />
          </Card>
        </div>
      </div>

      <Card
        title="Evolução da poupança"
        subtitle="Saldo acumulado sem rendimentos de investimento, comparado à meta (que cresce se houver aumento de custos previsto)."
        action={
          <Button size="sm" onClick={() => onNavigate('poupanca')}>
            Editar plano de poupança
          </Button>
        }
      >
        {p.rows.length > 0 ? <SavingsEvolutionChart projection={p} targetMonth={client.move.targetMonth} /> : <p className="text-sm text-navy-500">Defina o mês de início da poupança.</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Custo de vida mensal por categoria">
          <MonthlyBreakdownChart plan={plan} />
        </Card>
        <Card title="Impacto do câmbio" subtitle="Quanto a meta muda se o euro variar. Converter aos poucos reduz o risco de comprar tudo no pico.">
          <FxSensitivityTable client={client} scenario={scenario} plan={plan} />
        </Card>
      </div>

      <Card
        title="Comparação de cenários"
        subtitle="Cada diferença vem de premissas explícitas e editáveis em “Cenários e custos”."
        action={
          <Button size="sm" onClick={() => onNavigate('cenarios')}>
            Editar cenários
          </Button>
        }
      >
        <ScenarioComparisonChart items={comparison.filter((c) => c.plan.valid)} />
        <div className="mt-4">
          <ScenarioComparisonTable items={comparison} selectedId={client.selectedScenarioId} />
        </div>
      </Card>
    </div>
  );
}
