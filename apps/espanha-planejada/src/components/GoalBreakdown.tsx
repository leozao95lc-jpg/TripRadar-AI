import type { PlanResult } from '../domain/calc';
import { money } from '../lib/format';
import { cx } from './ui';

/** Tabela transparente de como a meta é formada, com as moedas separadas. */
export default function GoalBreakdown({ plan, showCurrencies = true }: { plan: PlanResult; showCurrencies?: boolean }) {
  const m = plan.main;
  const rows: { label: string; hint: string; v: { eur: number; brl: number; totalBRL: number }; kind: 'gasto' | 'deposito' | 'reserva' | 'credito' }[] = [
    { label: 'Custos únicos definitivos', hint: 'Gastos que não voltam: passagens, documentos, instalação, comissões.', v: m.oneTimeDefinitive, kind: 'gasto' },
    { label: 'Depósitos e cauções', hint: 'Potencialmente reembolsáveis, mas precisam ser pagos na chegada.', v: m.deposits, kind: 'deposito' },
    {
      label: `Custo de vida financiado (${plan.runwayMonths} meses)`,
      hint: 'Meses de vida na Espanha pagos com a reserva, sem depender de renda.',
      v: m.runwayGross,
      kind: 'gasto',
    },
  ];
  if (m.incomeOffset.totalBRL > 0) {
    rows.push({ label: '(−) Renda futura considerada', hint: 'Só entra porque o cenário mandou incluir.', v: { eur: -m.incomeOffset.eur, brl: -m.incomeOffset.brl, totalBRL: -m.incomeOffset.totalBRL }, kind: 'credito' });
  }
  rows.push(
    { label: 'Margem para imprevistos', hint: 'Percentual do cenário sobre custos únicos definitivos + custo de vida.', v: m.contingency, kind: 'gasto' },
    { label: 'Reserva de emergência', hint: 'Dinheiro que permanece disponível — não é para gastar no plano.', v: m.emergency, kind: 'reserva' },
  );

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Componente</th>
            {showCurrencies && <th className="r hidden sm:table-cell">Em euros</th>}
            {showCurrencies && <th className="r hidden sm:table-cell">Em reais</th>}
            <th className="r">Total em R$</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>
                <div className="flex items-center gap-2">
                  <span
                    className={cx(
                      'h-2 w-2 shrink-0 rounded-full',
                      r.kind === 'gasto' && 'bg-navy-700',
                      r.kind === 'deposito' && 'bg-navy-300',
                      r.kind === 'reserva' && 'bg-verde-400',
                      r.kind === 'credito' && 'bg-amber-500',
                    )}
                  />
                  <span className="font-medium text-navy-900">{r.label}</span>
                </div>
                <p className="ml-4 text-xs text-navy-500">{r.hint}</p>
              </td>
              {showCurrencies && <td className="r hidden sm:table-cell">{money(r.v.eur, 'EUR')}</td>}
              {showCurrencies && <td className="r hidden sm:table-cell">{money(r.v.brl)}</td>}
              <td className="r font-medium">{money(r.v.totalBRL)}</td>
            </tr>
          ))}
          <tr className="bg-areia-50 font-semibold">
            <td>Meta total de recursos</td>
            {showCurrencies && <td className="r hidden sm:table-cell">{money(m.required.eur, 'EUR')}</td>}
            {showCurrencies && <td className="r hidden sm:table-cell">{money(m.required.brl)}</td>}
            <td className="r">{money(m.required.totalBRL)}</td>
          </tr>
          <tr>
            <td>(−) Recursos destinados à mudança</td>
            {showCurrencies && <td className="r hidden sm:table-cell">{money(m.available.eur, 'EUR')}</td>}
            {showCurrencies && <td className="r hidden sm:table-cell">{money(m.available.brl)}</td>}
            <td className="r">{money(m.available.totalBRL)}</td>
          </tr>
          <tr className="font-semibold">
            <td>{m.shortfallBRL > 0 ? 'Valor que falta juntar' : 'Acima da meta'}</td>
            {showCurrencies && <td className="hidden sm:table-cell" />}
            {showCurrencies && <td className="hidden sm:table-cell" />}
            <td className={cx('r', m.shortfallBRL > 0 ? 'text-terra-700' : 'text-verde-700')}>{money(m.shortfallBRL > 0 ? m.shortfallBRL : m.surplusBRL)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-navy-500">
        Euros convertidos a R$ {plan.rates.buyRate.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} (câmbio R${' '}
        {plan.rates.rate.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} + custo de conversão). Euros que o cliente já possui cobrem primeiro os custos
        em euro; o excedente vale o câmbio de venda (R$ {plan.rates.sellRate.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}).
        {m.available.preservedBRL > 0 && ` ${money(m.available.preservedBRL)} preservados para outras finalidades foram excluídos.`}
        {plan.alreadyPaidBRL > 0 && ` ${money(plan.alreadyPaidBRL)} já pagos não entram na meta nem nos recursos.`}
      </p>
    </div>
  );
}
