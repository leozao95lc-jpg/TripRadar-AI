import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ScenarioComparison } from '../domain/analysis';
import type { PlanResult } from '../domain/calc';
import type { ProjectionResult } from '../domain/savings';
import { monthLabel } from '../lib/dates';
import { money } from '../lib/format';

export const COLORS = {
  navy: '#21385d',
  navyLight: '#7f9fc9',
  verde: '#1f9a67',
  verdeLight: '#6dcfa4',
  terra: '#c8662e',
  areia: '#d9d2c4',
  amber: '#c99a1c',
};

const compact = (v: number) =>
  Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

const tooltipStyle = { borderRadius: 10, border: '1px solid #ebe6dc', fontSize: 12 };

export function compositionData(plan: PlanResult) {
  const m = plan.main;
  return [
    { name: 'Custos únicos definitivos', value: m.oneTimeDefinitive.totalBRL, color: COLORS.navy },
    { name: 'Depósitos reembolsáveis', value: m.deposits.totalBRL, color: COLORS.navyLight },
    { name: `Custo de vida (${plan.runwayMonths} meses)`, value: m.runwayNet.totalBRL, color: COLORS.verde },
    { name: 'Margem para imprevistos', value: m.contingency.totalBRL, color: COLORS.amber },
    { name: 'Reserva de emergência', value: m.emergency.totalBRL, color: COLORS.verdeLight },
  ];
}

export function CostDistributionChart({ plan, height = 240 }: { plan: PlanResult; height?: number }) {
  const data = compositionData(plan);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#ebe6dc" />
        <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11, fill: '#5579ad' }} />
        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: '#21385d' }} />
        <Tooltip formatter={(v: number) => money(v)} contentStyle={tooltipStyle} cursor={{ fill: '#f5f2ec' }} />
        <Bar dataKey="value" name="Valor" radius={[0, 6, 6, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyBreakdownChart({ plan, height = 260 }: { plan: PlanResult; height?: number }) {
  const byCat = new Map<string, number>();
  for (const l of plan.monthlyLines) byCat.set(l.categoryLabel, (byCat.get(l.categoryLabel) ?? 0) + l.subtotalBRL);
  const data = [...byCat.entries()].map(([name, value]) => ({ name, value })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#ebe6dc" />
        <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11, fill: '#5579ad' }} />
        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: '#21385d' }} />
        <Tooltip formatter={(v: number) => money(v)} contentStyle={tooltipStyle} cursor={{ fill: '#f5f2ec' }} />
        <Bar dataKey="value" name="Por mês" fill={COLORS.verde} radius={[0, 6, 6, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GoalVsReserveChart({ plan, height = 200 }: { plan: PlanResult; height?: number }) {
  const m = plan.main;
  const data = [
    { name: 'Meta', recursos: 0, falta: 0, meta: m.required.totalBRL },
    { name: 'Hoje', recursos: Math.min(m.available.totalBRL, m.required.totalBRL), falta: m.shortfallBRL, meta: 0, sobra: m.surplusBRL },
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11, fill: '#5579ad' }} />
        <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 12, fill: '#21385d' }} />
        <Tooltip formatter={(v: number) => money(v)} contentStyle={tooltipStyle} cursor={{ fill: '#f5f2ec' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="meta" name="Meta total" stackId="a" fill={COLORS.navy} isAnimationActive={false} />
        <Bar dataKey="recursos" name="Recursos disponíveis" stackId="a" fill={COLORS.verde} isAnimationActive={false} />
        <Bar dataKey="falta" name="Falta juntar" stackId="a" fill={COLORS.terra} isAnimationActive={false} />
        <Bar dataKey="sobra" name="Acima da meta" stackId="a" fill={COLORS.verdeLight} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SavingsEvolutionChart({ projection, targetMonth, height = 280 }: { projection: ProjectionResult; targetMonth: string; height?: number }) {
  const data = [
    { label: 'Hoje', saldo: projection.startBalance, meta: projection.goalToday, month: '' },
    ...projection.rows.map((r) => ({ label: monthLabel(r.month), saldo: r.closing, meta: r.goal, month: r.month })),
  ];
  const target = data.find((d) => d.month === targetMonth);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid stroke="#ebe6dc" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#5579ad' }} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#5579ad' }} width={78} />
        <Tooltip formatter={(v: number) => money(v)} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {target && <ReferenceLine x={target.label} stroke={COLORS.terra} strokeDasharray="4 4" label={{ value: 'Data pretendida', fontSize: 10, fill: COLORS.terra, position: 'insideTopLeft' }} />}
        <Line type="monotone" dataKey="meta" name="Meta" stroke={COLORS.navy} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="saldo" name="Saldo acumulado" stroke={COLORS.verde} strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ScenarioComparisonChart({ items, height = 260 }: { items: ScenarioComparison[]; height?: number }) {
  const data = items.map((i) => ({
    name: i.scenario.name,
    unicos: i.plan.main.oneTimeDefinitive.totalBRL + i.plan.main.deposits.totalBRL,
    vida: i.plan.main.runwayNet.totalBRL,
    seguranca: i.plan.main.contingency.totalBRL + i.plan.main.emergency.totalBRL,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid stroke="#ebe6dc" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#21385d' }} />
        <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#5579ad' }} width={78} />
        <Tooltip formatter={(v: number) => money(v)} contentStyle={tooltipStyle} cursor={{ fill: '#f5f2ec' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="unicos" name="Custos iniciais + depósitos" stackId="s" fill={COLORS.navy} isAnimationActive={false} />
        <Bar dataKey="vida" name="Custo de vida financiado" stackId="s" fill={COLORS.verde} isAnimationActive={false} />
        <Bar dataKey="seguranca" name="Margem + reserva" stackId="s" fill={COLORS.amber} radius={[6, 6, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
