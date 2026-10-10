import { Check, ChevronLeft, ChevronRight, RefreshCw, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import type { Mutate } from '../pages/ClientWorkspace';
import { FLEX_LABELS, HOUSING_HINTS, HOUSING_LABELS, INCOME_AFTER_LABELS, PROFILE_LABELS } from '../domain/labels';
import { rebuildScenariosFor } from '../domain/templates';
import type { Client, Finances, HousingType, MovePlan, PersonalInfo, ProfileKind } from '../domain/types';
import { isValidMonth } from '../lib/dates';
import { money } from '../lib/format';
import { useStore } from '../store/useStore';
import { Button, Card, Field, Modal, NumberInput, Select, TextArea, TextInput, Toggle, cx } from './ui';

const STEPS = ['Pessoas e família', 'Plano de mudança', 'Situação financeira', 'Revisão'];

export default function ClientForm({ client, mutate, onDone }: { client: Client; mutate: Mutate; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const settings = useStore((s) => s.settings);
  const p = client.personal;
  const m = client.move;
  const f = client.finances;

  const setP = <K extends keyof PersonalInfo>(k: K, v: PersonalInfo[K]) => mutate((d) => void (d.personal[k] = v));
  const setM = <K extends keyof MovePlan>(k: K, v: MovePlan[K]) => mutate((d) => void (d.move[k] = v));
  const setF = <K extends keyof Finances>(k: K, v: Finances[K]) => mutate((d) => void (d.finances[k] = v));

  const errors: Record<number, string[]> = {
    0: [!p.name.trim() && 'Informe o nome do cliente.', p.adults < 1 && 'Informe ao menos 1 adulto.'].filter(Boolean) as string[],
    1: [!m.targetCity.trim() && 'Informe a cidade pretendida.', !isValidMonth(m.targetMonth) && 'Informe o mês e ano pretendidos.'].filter(Boolean) as string[],
    2: [],
    3: [],
  };

  const next = () => {
    setTouched(true);
    if (errors[step].length === 0) {
      setTouched(false);
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    }
  };

  const hasChildItems = client.scenarios.some((s) => s.monthlyCosts.some((c) => c.scaling === 'por_crianca'));
  const hasPetItems = client.scenarios.some((s) => [...s.monthlyCosts, ...s.oneTimeCosts].some((c) => c.scaling === 'por_animal'));
  const hasLodging = client.scenarios.some((s) => s.oneTimeCosts.some((c) => c.category === 'hospedagem_temporaria'));
  const mismatch: string[] = [];
  if (p.children > 0 && !hasChildItems) mismatch.push('há crianças, mas os cenários não têm custos por criança');
  if (p.pets > 0 && !hasPetItems) mismatch.push('há animais, mas os cenários não têm custos com animais');
  if (m.needsTempLodging && !hasLodging) mismatch.push('precisa de hospedagem temporária, mas os cenários não a incluem');
  if (!m.needsTempLodging && hasLodging) mismatch.push('não precisa de hospedagem temporária, mas os cenários a incluem');

  const computedCapacity = f.monthlyIncomeBRL - f.monthlyExpensesBRL - f.monthlyDebtBRL;

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <ol className="flex gap-2 overflow-x-auto lg:flex-col">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={cx(
                'flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm',
                i === step ? 'bg-navy-800 text-white' : 'text-navy-600 hover:bg-areia-100',
              )}
            >
              <span className={cx('flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold', i === step ? 'bg-verde-400 text-navy-900' : 'bg-areia-200')}>
                {i + 1}
              </span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-4">
        {mismatch.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p>
              <strong>Cadastro e cenários divergentes:</strong> {mismatch.join('; ')}.
            </p>
            <Button size="sm" onClick={() => setRebuildOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5" /> Recriar cenários-modelo
            </Button>
          </div>
        )}

        {step === 0 && (
          <Card title="Pessoas e família" subtitle="Quem vai se mudar. A composição define como os custos escalam.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do cliente" required error={touched && !p.name.trim() ? 'Campo obrigatório' : null} className="sm:col-span-2">
                <TextInput value={p.name} onChange={(e) => setP('name', e.target.value)} placeholder="Nome ou nome do casal/família" invalid={touched && !p.name.trim()} />
              </Field>
              <Field label="E-mail" hint="Opcional. Usado só para contato.">
                <TextInput type="email" value={p.email} onChange={(e) => setP('email', e.target.value)} />
              </Field>
              <Field label="Telefone / WhatsApp" hint="Opcional.">
                <TextInput value={p.phone} onChange={(e) => setP('phone', e.target.value)} />
              </Field>
              <Field label="Perfil" hint="Define os cenários-modelo. Não altera os cenários já criados.">
                <Select<ProfileKind>
                  value={client.profile}
                  onChange={(v) => mutate((d) => void (d.profile = v))}
                  options={(Object.keys(PROFILE_LABELS) as ProfileKind[]).map((k) => ({ value: k, label: PROFILE_LABELS[k] }))}
                />
              </Field>
              <div />
              <Field label="Adultos" required>
                <NumberInput value={p.adults} onChange={(v) => setP('adults', v)} integer min={1} required />
              </Field>
              <Field label="Crianças">
                <NumberInput value={p.children} onChange={(v) => setP('children', v)} integer />
              </Field>
              <Field label="Idades das crianças" hint="Relevante para escola e custos específicos." className="sm:col-span-2">
                <TextInput value={p.childrenAges} onChange={(e) => setP('childrenAges', e.target.value)} placeholder="Ex.: 4 e 9 anos" disabled={p.children === 0} />
              </Field>
              <Field label="Animais de estimação">
                <NumberInput value={p.pets} onChange={(v) => setP('pets', v)} integer />
              </Field>
              <Field label="Detalhes dos animais">
                <TextInput value={p.petDetails} onChange={(e) => setP('petDetails', e.target.value)} placeholder="Espécie, porte" disabled={p.pets === 0} />
              </Field>
              <Field label="Situação familiar" className="sm:col-span-2">
                <TextArea value={p.familySituation} onChange={(e) => setP('familySituation', e.target.value)} placeholder="Ex.: casal, um trabalha remoto; filhos em idade escolar" />
              </Field>
              <Field label="Dependentes financeiros" hint="Pessoas que dependem do cliente, inclusive quem fica no Brasil." className="sm:col-span-2">
                <TextArea value={p.financialDependents} onChange={(e) => setP('financialDependents', e.target.value)} />
              </Field>
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card title="Plano de mudança" subtitle="O que o cliente declara. A ferramenta não avalia elegibilidade migratória.">
            <div className="mb-4 flex gap-2 rounded-lg border border-navy-100 bg-navy-50 px-3 py-2.5 text-xs text-navy-700">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <p>
                A via migratória e a situação da documentação são registradas como <strong>informação declarada</strong>. Requisitos, valores exigidos e
                prazos precisam ser verificados individualmente em fonte oficial (consulado e órgãos do governo espanhol), com data da consulta.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cidade pretendida" required error={touched && !m.targetCity.trim() ? 'Campo obrigatório' : null}>
                <TextInput value={m.targetCity} onChange={(e) => setM('targetCity', e.target.value)} placeholder="Ex.: Valência" invalid={touched && !m.targetCity.trim()} />
              </Field>
              <Field label="Outras cidades consideradas">
                <TextInput value={m.otherCities} onChange={(e) => setM('otherCities', e.target.value)} />
              </Field>
              <Field label="Mês e ano pretendidos" required error={touched && !isValidMonth(m.targetMonth) ? 'Informe mês e ano' : null}>
                <TextInput type="month" value={m.targetMonth} onChange={(e) => setM('targetMonth', e.target.value)} />
              </Field>
              <Field label="Flexibilidade da data">
                <Select value={m.dateFlexibility} onChange={(v) => setM('dateFlexibility', v)} options={Object.entries(FLEX_LABELS).map(([value, label]) => ({ value: value as MovePlan['dateFlexibility'], label }))} />
              </Field>
              <Field label="Objetivo geral da mudança" className="sm:col-span-2">
                <TextArea value={m.goal} onChange={(e) => setM('goal', e.target.value)} placeholder="Trabalho, estudo, qualidade de vida, família…" />
              </Field>
              <Field label="Via migratória que o cliente está considerando" hint="Informação declarada — não é uma avaliação.">
                <TextInput value={m.migrationRoute} onChange={(e) => setM('migrationRoute', e.target.value)} placeholder="Ex.: estudante, nômade digital, cidadania" />
              </Field>
              <Field label="Situação atual da documentação">
                <TextInput value={m.documentationStatus} onChange={(e) => setM('documentationStatus', e.target.value)} />
              </Field>
              <Field label="Tipo de moradia pretendida" hint={HOUSING_HINTS[m.housingIntent]} className="sm:col-span-2">
                <Select<HousingType>
                  value={m.housingIntent}
                  onChange={(v) => setM('housingIntent', v)}
                  options={(Object.keys(HOUSING_LABELS) as HousingType[]).map((k) => ({ value: k, label: HOUSING_LABELS[k] }))}
                />
              </Field>
              <div className="flex flex-col gap-3 sm:col-span-2">
                <Toggle
                  checked={m.ticketsBought}
                  onChange={(v) =>
                    mutate((d) => {
                      d.move.ticketsBought = v;
                      for (const s of d.scenarios) for (const c of s.oneTimeCosts) if (c.category === 'passagens') c.alreadyPaid = v;
                    })
                  }
                  label="Passagens já compradas"
                  hint="Marca as passagens como já pagas em todos os cenários: saem da meta e não contam como recurso."
                />
                <Toggle checked={m.needsTempLodging} onChange={(v) => setM('needsTempLodging', v)} label="Precisa de hospedagem temporária na chegada" />
              </div>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card title="Situação financeira" subtitle="Valores mensais em reais. Não pedimos dados bancários, documentos ou senhas.">
            <div className="grid gap-4 sm:grid-cols-2">
              <h4 className="text-sm font-semibold text-navy-700 sm:col-span-2">Recursos para a mudança</h4>
              <Field label="Reserva disponível em reais">
                <NumberInput value={f.reserveBRL} onChange={(v) => setF('reserveBRL', v)} prefix="R$" />
              </Field>
              <Field label="Reserva disponível em euros" hint="Euros já comprados: cobrem custos em euro sem nova conversão.">
                <NumberInput value={f.reserveEUR} onChange={(v) => setF('reserveEUR', v)} prefix="€" />
              </Field>
              <Field label="Outros recursos que realmente estarão disponíveis" hint="Ex.: venda de carro já negociada. Não inclua o que é incerto.">
                <NumberInput value={f.otherResourcesBRL} onChange={(v) => setF('otherResourcesBRL', v)} prefix="R$" />
              </Field>
              <Field label="Descrição dos outros recursos">
                <TextInput value={f.otherResourcesNote} onChange={(e) => setF('otherResourcesNote', e.target.value)} />
              </Field>
              <Field label="Valor a preservar para outras finalidades" hint="Sai dos recursos da mudança (ex.: reserva que fica no Brasil)." className="sm:col-span-2">
                <NumberInput value={f.preservedBRL} onChange={(v) => setF('preservedBRL', v)} prefix="R$" />
              </Field>

              <h4 className="mt-2 text-sm font-semibold text-navy-700 sm:col-span-2">Orçamento atual no Brasil</h4>
              <Field label="Renda mensal atual (líquida)">
                <NumberInput value={f.monthlyIncomeBRL} onChange={(v) => setF('monthlyIncomeBRL', v)} prefix="R$" />
              </Field>
              <Field label="Despesas mensais no Brasil" hint="Sem contar as parcelas de dívidas.">
                <NumberInput value={f.monthlyExpensesBRL} onChange={(v) => setF('monthlyExpensesBRL', v)} prefix="R$" />
              </Field>
              <Field label="Dívidas e parcelas mensais">
                <NumberInput value={f.monthlyDebtBRL} onChange={(v) => setF('monthlyDebtBRL', v)} prefix="R$" />
              </Field>
              <Field
                label="Capacidade mensal de poupança"
                hint={
                  f.monthlyIncomeBRL > 0
                    ? `Renda − despesas − parcelas = ${money(computedCapacity)}. Use o valor que o cliente consegue manter de fato.`
                    : 'Quanto o cliente consegue guardar por mês para a mudança.'
                }
                error={f.monthlyIncomeBRL > 0 && f.savingsCapacityBRL > computedCapacity + 1 ? `Acima do que sobra no orçamento (${money(computedCapacity)}). Confirme.` : null}
              >
                <NumberInput value={f.savingsCapacityBRL} onChange={(v) => setF('savingsCapacityBRL', v)} prefix="R$" allowNegative />
              </Field>

              <h4 className="mt-2 text-sm font-semibold text-navy-700 sm:col-span-2">Depois da chegada</h4>
              <Field label="Renda após a chegada" hint="Renda apenas esperada nunca entra na meta automaticamente.">
                <Select value={f.incomeAfterArrival} onChange={(v) => setF('incomeAfterArrival', v)} options={Object.entries(INCOME_AFTER_LABELS).map(([value, label]) => ({ value: value as Finances['incomeAfterArrival'], label }))} />
              </Field>
              <Field label="Detalhes da renda esperada">
                <TextInput value={f.incomeAfterArrivalNote} onChange={(e) => setF('incomeAfterArrivalNote', e.target.value)} />
              </Field>
              <Field label="Compromissos que continuam no Brasil (R$/mês)" hint="Parcelas e apoio a dependentes que seguem após a mudança. Entram no custo de vida.">
                <NumberInput value={f.ongoingBrazilMonthlyBRL} onChange={(v) => setF('ongoingBrazilMonthlyBRL', v)} prefix="R$" />
              </Field>
              <Field label="Reserva de segurança que deseja manter intocada" hint="Dinheiro para emergências após a mudança.">
                <div className="flex flex-col gap-2">
                  <NumberInput value={f.safetyReserveBRL} onChange={(v) => setF('safetyReserveBRL', v)} prefix="R$" />
                  {f.safetyReserveBRL > 0 && (
                    <Button
                      size="sm"
                      className="self-start"
                      onClick={() =>
                        mutate((d) => {
                          for (const s of d.scenarios) s.emergency = { ...s.emergency, mode: 'valor', valueBRL: d.finances.safetyReserveBRL };
                        })
                      }
                    >
                      Usar como reserva de emergência em todos os cenários
                    </Button>
                  )}
                </div>
              </Field>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card title="Revisão" subtitle="Confira os dados antes de seguir para o painel.">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[
                ['Cliente', p.name || '—'],
                ['Composição', `${p.adults} adulto(s), ${p.children} criança(s), ${p.pets} animal(is)`],
                ['Cidade', m.targetCity || '—'],
                ['Data pretendida', m.targetMonth || '—'],
                ['Via declarada', m.migrationRoute || '—'],
                ['Reserva em reais', money(f.reserveBRL)],
                ['Reserva em euros', money(f.reserveEUR, 'EUR')],
                ['Outros recursos', money(f.otherResourcesBRL)],
                ['Preservado (fora da mudança)', money(f.preservedBRL)],
                ['Poupança mensal', money(f.savingsCapacityBRL)],
                ['Renda após chegada', INCOME_AFTER_LABELS[f.incomeAfterArrival]],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-areia-100 py-1.5">
                  <dt className="text-navy-500">{k}</dt>
                  <dd className="text-right font-medium text-navy-900">{v}</dd>
                </div>
              ))}
            </dl>
            {[0, 1].some((i) => errors[i].length > 0) && (
              <ul className="mt-4 list-inside list-disc text-sm text-terra-700">
                {[...errors[0], ...errors[1]].map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {touched && errors[step].length > 0 && <p className="text-sm text-terra-700">{errors[step].join(' ')}</p>}

        <div className="flex justify-between">
          <Button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={next}>
              Continuar <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="success"
              disabled={errors[0].length + errors[1].length > 0}
              onClick={() => {
                if (client.status === 'rascunho') mutate((d) => void (d.status = 'em_andamento'));
                onDone();
              }}
            >
              <Check className="h-4 w-4" /> Concluir cadastro
            </Button>
          )}
        </div>
        <p className="text-xs text-navy-400">As alterações são salvas automaticamente.</p>
      </div>

      <Modal
        open={rebuildOpen}
        onClose={() => setRebuildOpen(false)}
        title="Recriar cenários-modelo?"
        footer={
          <>
            <Button onClick={() => setRebuildOpen(false)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => {
                mutate((d) => {
                  const fx = d.scenarios[0]?.fx ?? settings.defaultFx;
                  d.scenarios = rebuildScenariosFor(d, fx);
                  d.selectedScenarioId = d.scenarios[1].id;
                });
                setRebuildOpen(false);
              }}
            >
              Recriar e substituir
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-600">
          Os três cenários (Econômico, Intermediário e Conservador) serão recriados a partir do modelo, considerando a composição atual. Todas as
          personalizações e cotações dos cenários atuais serão perdidas. O câmbio do primeiro cenário será mantido.
        </p>
      </Modal>
    </div>
  );
}
