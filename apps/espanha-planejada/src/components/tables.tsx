import type { ScenarioComparison } from '../domain/analysis';
import { computeWithRate, type PlanResult } from '../domain/calc';
import { HOUSING_LABELS } from '../domain/labels';
import type { Client, Scenario } from '../domain/types';
import { money } from '../lib/format';
import { monthsToGoalText, reachedText } from '../lib/text';
import { cx } from './ui';

export function ScenarioComparisonTable({ items, selectedId }: { items: ScenarioComparison[]; selectedId: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Indicador</th>
            {items.map((i) => (
              <th key={i.scenario.id} className={cx('r', i.scenario.id === selectedId && 'text-verde-700')}>
                {i.scenario.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(
            [
              ['Moradia', (i) => HOUSING_LABELS[i.scenario.housing.type]],
              ['Aluguel', (i) => money(i.scenario.housing.monthlyRent, i.scenario.housing.currency)],
              ['Custo de vida mensal', (i) => money(i.plan.monthlyLiving.totalBRL)],
              ['Meses financiados', (i) => String(i.plan.runwayMonths)],
              ['Custos únicos definitivos', (i) => money(i.plan.main.oneTimeDefinitive.totalBRL)],
              ['Depósitos', (i) => money(i.plan.main.deposits.totalBRL)],
              ['Margem para imprevistos', (i) => `${i.scenario.contingencyPct}% · ${money(i.plan.main.contingency.totalBRL)}`],
              ['Reserva de emergência', (i) => money(i.plan.main.emergency.totalBRL)],
              ['Câmbio (R$/€)', (i) => i.plan.rates.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })],
              ['Meta total', (i) => money(i.plan.main.required.totalBRL), true],
              ['Falta juntar', (i) => money(i.plan.main.shortfallBRL), true],
              ['Meses até a meta', (i) => monthsToGoalText(i.projection)],
              ['Data projetada', (i) => reachedText(i.projection)],
            ] as [string, (i: ScenarioComparison) => string, boolean?][]
          ).map(([label, fn, strong]) => (
            <tr key={label} className={strong ? 'font-semibold' : undefined}>
              <td>{label}</td>
              {items.map((i) => (
                <td key={i.scenario.id} className={cx('r', i.scenario.id === selectedId && 'bg-verde-50/60')}>
                  {i.plan.valid ? fn(i) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const FX_DELTAS = [-0.5, 0, 0.5, 1];

export function FxSensitivityTable({ client, scenario, plan }: { client: Client; scenario: Scenario; plan: PlanResult }) {
  if (!plan.valid) return null;
  const rows = FX_DELTAS.map((d) => {
    const rate = Math.max(0.01, plan.rates.rate + d);
    const p = d === 0 ? plan : computeWithRate(client, scenario, rate);
    return { d, rate, required: p.main.required.totalBRL, shortfall: p.main.shortfallBRL };
  });
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Câmbio (R$/€)</th>
            <th className="r">Meta total</th>
            <th className="r">Falta juntar</th>
            <th className="r">Diferença na meta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.d} className={r.d === 0 ? 'bg-areia-50 font-semibold' : undefined}>
              <td>
                {r.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                {r.d === 0 ? ' (atual)' : ` (${r.d > 0 ? '+' : ''}${r.d.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`}
              </td>
              <td className="r">{money(r.required)}</td>
              <td className="r">{money(r.shortfall)}</td>
              <td className="r">{r.d === 0 ? '—' : `${r.required - plan.main.required.totalBRL >= 0 ? '+' : ''}${money(r.required - plan.main.required.totalBRL)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
