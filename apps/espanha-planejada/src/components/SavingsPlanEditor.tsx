import { Plus, Trash2 } from 'lucide-react';
import type { Analysis } from '../domain/analysis';
import { HORIZON } from '../domain/savings';
import type { CashEvent, Client } from '../domain/types';
import { addMonths, isValidMonth, monthLabel } from '../lib/dates';
import { money } from '../lib/format';
import { uid } from '../lib/id';
import { monthsToGoalText, reachedText, requiredMonthlyText } from '../lib/text';
import type { Mutate } from '../pages/ClientWorkspace';
import { SavingsEvolutionChart } from './charts';
import { Button, Card, Field, NumberInput, Select, Stat, TextInput, cx } from './ui';

export default function SavingsPlanEditor({ client, mutate, analysis }: { client: Client; mutate: Mutate; analysis: Analysis }) {
  const sp = client.savingsPlan;
  const p = analysis.projection;
  const start = isValidMonth(sp.startMonth) ? sp.startMonth : null;
  const monthOptions = Array.from({ length: HORIZON }, (_, i) => ({
    value: String(i + 1),
    label: start ? `${i + 1} · ${monthLabel(addMonths(start, i))}` : `Mês ${i + 1}`,
  }));

  const eventEditor = (key: 'contributions' | 'extraExpenses', title: string, hint: string) => (
    <Card
      title={title}
      subtitle={hint}
      action={
        <Button size="sm" onClick={() => mutate((d) => void d.savingsPlan[key].push({ id: uid('ev'), month: 1, amount: 0, description: '' }))}>
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      }
    >
      {sp[key].length === 0 ? (
        <p className="text-sm text-navy-500">Nenhum lançamento.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sp[key].map((e: CashEvent) => {
            const set = (patch: Partial<CashEvent>) => mutate((d) => void Object.assign(d.savingsPlan[key].find((x) => x.id === e.id) ?? {}, patch));
            return (
              <div key={e.id} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[160px_140px_1fr_auto]">
                <Field label="Mês">
                  <Select value={String(e.month)} onChange={(v) => set({ month: Number(v) })} options={monthOptions} />
                </Field>
                <Field label="Valor">
                  <NumberInput value={e.amount} onChange={(v) => set({ amount: v })} prefix="R$" />
                </Field>
                <Field label="Descrição" className="col-span-2 sm:col-span-1">
                  <TextInput value={e.description} onChange={(ev) => set({ description: ev.target.value })} placeholder={key === 'contributions' ? 'Ex.: 13º salário, venda do carro' : 'Ex.: emissão de documentos'} />
                </Field>
                <Button variant="ghost" size="sm" aria-label="Remover" onClick={() => mutate((d) => void (d.savingsPlan[key] = d.savingsPlan[key].filter((x) => x.id !== e.id)))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Falta juntar hoje" value={money(analysis.plan.main.shortfallBRL)} />
        <Stat label="Meta mensal p/ data pretendida" value={requiredMonthlyText(p)} tone={p.requiredMonthlyToMove !== null && p.requiredMonthlyToMove > p.baseSavings ? 'danger' : 'default'} />
        <Stat label="Meses até a meta" value={monthsToGoalText(p)} tone={p.unreachable ? 'danger' : 'default'} />
        <Stat label="Data projetada" value={reachedText(p)} />
      </div>

      <Card title="Premissas da poupança" subtitle="Sem rendimentos de investimentos: o saldo cresce apenas com o que é poupado e aportado.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Início da poupança" required>
            <TextInput type="month" value={sp.startMonth} onChange={(e) => mutate((d) => void (d.savingsPlan.startMonth = e.target.value))} />
          </Field>
          <Field label="Poupança mensal padrão" hint="Vem do cadastro (capacidade de poupança).">
            <NumberInput value={client.finances.savingsCapacityBRL} onChange={(v) => mutate((d) => void (d.finances.savingsCapacityBRL = v))} prefix="R$" allowNegative />
          </Field>
          <Field label="Saldo inicial" hint="Recursos destinados à mudança, em reais equivalentes.">
            <p className="py-2 text-lg font-semibold tabular-nums">{money(p.startBalance)}</p>
          </Field>
        </div>
      </Card>

      <Card
        title="Poupança por período"
        subtitle="Substitui a poupança padrão em meses específicos (ex.: menos nos meses de férias, mais após quitar uma dívida)."
        action={
          <Button size="sm" onClick={() => mutate((d) => void d.savingsPlan.periods.push({ id: uid('pr'), fromMonth: 1, toMonth: 6, amount: d.finances.savingsCapacityBRL }))}>
            <Plus className="h-3.5 w-3.5" /> Adicionar período
          </Button>
        }
      >
        {sp.periods.length === 0 ? (
          <p className="text-sm text-navy-500">Todos os meses usam a poupança padrão de {money(client.finances.savingsCapacityBRL)}.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sp.periods.map((per) => {
              const set = (patch: Partial<typeof per>) => mutate((d) => void Object.assign(d.savingsPlan.periods.find((x) => x.id === per.id) ?? {}, patch));
              return (
                <div key={per.id} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[160px_160px_160px_auto]">
                  <Field label="Do mês">
                    <Select value={String(per.fromMonth)} onChange={(v) => set({ fromMonth: Number(v), toMonth: Math.max(Number(v), per.toMonth) })} options={monthOptions} />
                  </Field>
                  <Field label="Até o mês">
                    <Select value={String(per.toMonth)} onChange={(v) => set({ toMonth: Number(v) })} options={monthOptions.filter((o) => Number(o.value) >= per.fromMonth)} />
                  </Field>
                  <Field label="Poupança mensal">
                    <NumberInput value={per.amount} onChange={(v) => set({ amount: v })} prefix="R$" allowNegative />
                  </Field>
                  <Button variant="ghost" size="sm" aria-label="Remover" onClick={() => mutate((d) => void (d.savingsPlan.periods = d.savingsPlan.periods.filter((x) => x.id !== per.id)))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <p className="text-xs text-navy-500">Se dois períodos se sobrepõem, vale o último da lista.</p>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {eventEditor('contributions', 'Aportes extraordinários', 'Entradas pontuais confirmadas: 13º, férias, venda de bens.')}
        {eventEditor('extraExpenses', 'Despesas extraordinárias previstas', 'Saídas pontuais antes da mudança que reduzem o saldo.')}
      </div>

      <Card title="Evolução da poupança">
        <SavingsEvolutionChart projection={p} targetMonth={client.move.targetMonth} />
      </Card>

      <Card title={`Projeção mês a mês (${HORIZON} meses)`} subtitle="Diferença = saldo acumulado − meta do mês. Valores negativos indicam quanto ainda falta.">
        <div className="max-h-[560px] overflow-auto">
          <table className="data-table">
            <thead className="sticky top-0">
              <tr>
                <th>Mês</th>
                <th className="r">Saldo inicial</th>
                <th className="r">Poupança</th>
                <th className="r">Aportes</th>
                <th className="r">Desp. extra</th>
                <th className="r">Saldo acumulado</th>
                <th className="r">Meta</th>
                <th className="r">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map((r) => (
                <tr key={r.index} className={cx(r.month === client.move.targetMonth && 'bg-terra-50', p.monthsToGoal === r.index && 'bg-verde-50 font-semibold')}>
                  <td className="whitespace-nowrap">
                    {r.index}. {monthLabel(r.month)}
                    {r.month === client.move.targetMonth && <span className="ml-1 text-[10px] font-semibold uppercase text-terra-600">mudança</span>}
                    {p.monthsToGoal === r.index && <span className="ml-1 text-[10px] font-semibold uppercase text-verde-700">meta</span>}
                  </td>
                  <td className="r">{money(r.opening)}</td>
                  <td className="r">{money(r.savings)}</td>
                  <td className="r">{r.contributions ? money(r.contributions) : '—'}</td>
                  <td className="r">{r.extraExpenses ? money(-r.extraExpenses) : '—'}</td>
                  <td className="r font-medium">{money(r.closing)}</td>
                  <td className="r">{money(r.goal)}</td>
                  <td className={cx('r', r.gap >= 0 ? 'text-verde-700' : 'text-terra-700')}>{money(r.gap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
