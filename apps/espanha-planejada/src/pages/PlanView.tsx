import { CalendarClock, CheckCircle2, Circle, PiggyBank, Target, Wallet } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { SavingsEvolutionChart } from '../components/charts';
import { checklistProgress } from '../components/ChecklistEditor';
import { AlertList, ProgressBar } from '../components/ui';
import { HOUSING_LABELS } from '../domain/labels';
import { monthLabel } from '../lib/dates';
import { money, pct } from '../lib/format';
import { useAnalysis } from '../lib/hooks';
import { monthsToGoalText, reachedText, requiredMonthlyText } from '../lib/text';
import { useClient } from '../store/useStore';

/** Área de planejamento: visão simplificada para apresentar ao cliente. */
export default function PlanView() {
  const { id } = useParams();
  const client = useClient(id);
  const analysis = useAnalysis(client);

  if (!client || !analysis) {
    return (
      <div className="p-10 text-center text-sm text-navy-600">
        Planejamento não encontrado neste navegador. <Link to="/" className="text-verde-700 underline">Voltar</Link>
      </div>
    );
  }

  const { plan, projection: p, scenario, alerts } = analysis;
  const m = plan.main;
  const ck = checklistProgress(client.checklist);
  const nextTasks = client.checklist.filter((i) => i.status === 'pendente' || i.status === 'em_andamento').slice(0, 6);
  const firstName = (client.personal.name || 'Olá').split(/[ (—-]/)[0];

  const blocks = [
    { label: 'Gastos da mudança', hint: 'Passagens, documentos, instalação. Não voltam.', value: m.oneTimeDefinitive.totalBRL, color: 'bg-navy-700' },
    { label: 'Depósitos', hint: 'Cauções que podem ser devolvidas no fim do contrato.', value: m.deposits.totalBRL, color: 'bg-navy-300' },
    { label: `Primeiros ${plan.runwayMonths} meses de vida`, hint: 'Para viver sem depender de renda no começo.', value: m.runwayNet.totalBRL, color: 'bg-verde-600' },
    { label: 'Margem para imprevistos', hint: 'Para custos acima do previsto.', value: m.contingency.totalBRL, color: 'bg-amber-500' },
    { label: 'Reserva de emergência', hint: 'Fica guardada. Não é para gastar.', value: m.emergency.totalBRL, color: 'bg-verde-300' },
  ];

  return (
    <div className="min-h-screen bg-areia-50">
      <header className="bg-navy-900 text-white">
        <div className="mx-auto max-w-4xl px-5 py-8">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
                <rect width="32" height="32" rx="8" fill="#ffffff" />
                <path d="M8 21l5-6 4 4 7-9" fill="none" stroke="#1f9a67" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-semibold">Espanha Planejada</span>
            </div>
            <Link to={`/clientes/${client.id}`} className="no-print text-xs text-navy-200 hover:text-white">
              Área do consultor
            </Link>
          </div>
          <h1 className="mt-6 text-3xl font-semibold">{firstName}, este é o seu plano para {client.move.targetCity || 'a Espanha'}</h1>
          <p className="mt-2 text-navy-200">
            Mudança pretendida em {monthLabel(client.move.targetMonth)} · Cenário {scenario.name} · {HOUSING_LABELS[scenario.housing.type]}
          </p>
        </div>
      </header>

      <main className="mx-auto -mt-4 max-w-4xl px-5 pb-12">
        {!plan.valid ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-navy-600">O planejamento ainda está sendo preparado pela consultoria.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="grid gap-6 sm:grid-cols-3">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-navy-500">
                    <Target className="h-4 w-4 text-verde-600" /> Sua meta
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-navy-900">{money(m.required.totalBRL)}</p>
                  <p className="text-xs text-navy-500">Tudo o que você precisa ter para mudar com segurança, neste cenário.</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-navy-500">
                    <Wallet className="h-4 w-4 text-verde-600" /> Você já tem
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-navy-900">{money(m.available.totalBRL)}</p>
                  <p className="text-xs text-navy-500">{pct(m.progressPct)} do caminho.</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-navy-500">
                    <PiggyBank className="h-4 w-4 text-verde-600" /> {m.shortfallBRL > 0 ? 'Ainda falta' : 'Acima da meta'}
                  </p>
                  <p className={`mt-1 text-3xl font-semibold tabular-nums ${m.shortfallBRL > 0 ? 'text-terra-600' : 'text-verde-700'}`}>
                    {money(m.shortfallBRL > 0 ? m.shortfallBRL : m.surplusBRL)}
                  </p>
                </div>
              </div>
              <ProgressBar value={m.progressPct} className="mt-6 h-3" />
            </div>

            {m.shortfallBRL > 0 && (
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-navy-500">Para mudar na data pretendida</p>
                  <p className="mt-1 text-xl font-semibold">{requiredMonthlyText(p)}</p>
                  <p className="text-xs text-navy-500">de poupança por mês</p>
                </div>
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-navy-500">Poupando {money(p.baseSavings)}/mês</p>
                  <p className="mt-1 text-xl font-semibold">{monthsToGoalText(p)}</p>
                  <p className="text-xs text-navy-500">até chegar à meta</p>
                </div>
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-navy-500">
                    <CalendarClock className="h-3.5 w-3.5" /> Meta atingida em
                  </p>
                  <p className="mt-1 text-xl font-semibold">{reachedText(p)}</p>
                </div>
              </div>
            )}

            <section className="mt-5 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-navy-900">Do que é feita a sua meta</h2>
              <div className="mt-4 flex h-4 overflow-hidden rounded-full">
                {blocks
                  .filter((b) => b.value > 0)
                  .map((b) => (
                    <div key={b.label} className={b.color} style={{ width: `${(b.value / m.required.totalBRL) * 100}%` }} title={b.label} />
                  ))}
              </div>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {blocks.map((b) => (
                  <li key={b.label} className="flex items-start gap-3">
                    <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${b.color}`} />
                    <div className="flex-1">
                      <div className="flex justify-between gap-2">
                        <span className="text-sm font-medium text-navy-900">{b.label}</span>
                        <span className="text-sm font-semibold tabular-nums">{money(b.value)}</span>
                      </div>
                      <p className="text-xs text-navy-500">{b.hint}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-lg bg-areia-50 p-3 text-xs text-navy-600">
                Na Espanha, seu custo de vida estimado é de <strong>{money(plan.monthlyLiving.totalBRL)} por mês</strong> (cerca de{' '}
                {money(plan.monthlyLiving.eur, 'EUR')} em euros). O valor em reais depende do câmbio: cada R$ 0,10 a mais no euro aumenta a meta em cerca de{' '}
                {money(plan.fxImpactPer10Cents)}.
              </p>
            </section>

            <section className="mt-5 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-navy-900">Sua poupança mês a mês</h2>
              <SavingsEvolutionChart projection={p} targetMonth={client.move.targetMonth} height={240} />
            </section>

            {alerts.filter((a) => a.severity !== 'info').length > 0 && (
              <section className="mt-5 rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold text-navy-900">Pontos de atenção</h2>
                <AlertList alerts={alerts.filter((a) => a.severity !== 'info')} />
              </section>
            )}
          </>
        )}

        <section className="mt-5 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-navy-900">Próximos passos</h2>
            <span className="text-xs text-navy-500">
              {ck.done}/{ck.total} tarefas concluídas
            </span>
          </div>
          {client.notes.nextSteps && <p className="mt-2 whitespace-pre-wrap text-sm text-navy-700">{client.notes.nextSteps}</p>}
          <ul className="mt-3 flex flex-col gap-2">
            {nextTasks.map((t) => (
              <li key={t.id} className="flex items-start gap-2 text-sm">
                {t.status === 'em_andamento' ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-amber-500" /> : <Circle className="mt-0.5 h-4 w-4 text-navy-300" />}
                <span>
                  {t.title}
                  {t.requiresOfficialCheck && <span className="ml-1 text-xs text-amber-700">(confirmar em fonte oficial)</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-6 text-center text-xs leading-relaxed text-navy-400">
          Valores estimados com base nas fontes e datas registradas pela consultoria. Atingir a meta não garante um plano sem riscos. Não é assessoria
          jurídica ou migratória: requisitos oficiais devem ser verificados individualmente.
        </p>
      </main>
    </div>
  );
}
