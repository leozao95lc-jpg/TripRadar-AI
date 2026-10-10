import { Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Analysis } from '../domain/analysis';
import { HOUSING_HINTS, HOUSING_LABELS, LEVEL_HINTS, LEVEL_LABELS, STATUS_LABELS } from '../domain/labels';
import { RENT_REFERENCE, TEMPLATE_SOURCE, buildScenario, newMonthlyCost, newOneTimeCost } from '../domain/templates';
import type { Client, Currency, HousingType, MonthlyCost, OneTimeCost, Scenario, ScenarioLevel, ValueStatus } from '../domain/types';
import { daysBetween, todayISO } from '../lib/dates';
import { money } from '../lib/format';
import type { Mutate } from '../pages/ClientWorkspace';
import { duplicateScenario, useStore } from '../store/useStore';
import CostListEditor from './CostListEditor';
import { Badge, Button, Card, Field, Modal, NumberInput, Select, TextArea, TextInput, Toggle, cx } from './ui';

export default function ScenarioEditor({ client, mutate, analysis }: { client: Client; mutate: Mutate; analysis: Analysis }) {
  const settings = useStore((s) => s.settings);
  const sc = analysis.scenario;
  const plan = analysis.plan;
  const [newOpen, setNewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const ms = (fn: (s: Scenario, d: Client) => void) =>
    mutate((d) => {
      const s = d.scenarios.find((x) => x.id === sc.id);
      if (s) {
        fn(s, d);
        s.updatedAt = new Date().toISOString();
      }
    });

  const levelIdx = Math.max(0, ['economico', 'intermediario', 'conservador'].indexOf(sc.level));
  const fxAge = daysBetween(sc.fx.quotedAt, todayISO());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {client.scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => mutate((d) => void (d.selectedScenarioId = s.id))}
              className={cx(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
                s.id === sc.id ? 'border-navy-800 bg-navy-800 text-white' : 'border-areia-300 bg-white text-navy-700 hover:bg-areia-50',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              mutate((d) => {
                const src = d.scenarios.find((x) => x.id === sc.id);
                if (!src) return;
                const copy = duplicateScenario(src);
                d.scenarios.push(copy);
                d.selectedScenarioId = copy.id;
              })
            }
          >
            <Copy className="h-3.5 w-3.5" /> Duplicar cenário
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo a partir do modelo
          </Button>
          <Button size="sm" variant="danger" disabled={client.scenarios.length <= 1} onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
        </div>
      </div>

      <Card title="Premissas do cenário" subtitle={LEVEL_HINTS[sc.level]}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nome do cenário">
            <TextInput value={sc.name} onChange={(e) => ms((s) => void (s.name = e.target.value))} />
          </Field>
          <Field label="Tipo">
            <Select<ScenarioLevel>
              value={sc.level}
              onChange={(v) => ms((s) => void (s.level = v))}
              options={(Object.keys(LEVEL_LABELS) as ScenarioLevel[]).map((k) => ({ value: k, label: LEVEL_LABELS[k] }))}
            />
          </Field>
          <Field label="Meses de custo de vida financiados" hint="Período na Espanha pago só com a reserva.">
            <NumberInput value={sc.runwayMonths} onChange={(v) => ms((s) => void (s.runwayMonths = v))} integer max={36} suffix="meses" />
          </Field>
          <Field label="Margem para imprevistos" hint="Sobre custos únicos definitivos + custo de vida financiado.">
            <NumberInput value={sc.contingencyPct} onChange={(v) => ms((s) => void (s.contingencyPct = v))} max={100} suffix="%" />
          </Field>
          <Field label="Reserva de emergência">
            <Select
              value={sc.emergency.mode}
              onChange={(v) => ms((s) => void (s.emergency.mode = v))}
              options={[
                { value: 'meses', label: 'Em meses de custo de vida' },
                { value: 'valor', label: 'Valor fixo em reais' },
              ]}
            />
          </Field>
          {sc.emergency.mode === 'meses' ? (
            <Field label="Meses de reserva" hint={`= ${money(plan.main.emergency.totalBRL)}`}>
              <NumberInput value={sc.emergency.months} onChange={(v) => ms((s) => void (s.emergency.months = v))} max={36} suffix="meses" />
            </Field>
          ) : (
            <Field label="Valor da reserva">
              <NumberInput value={sc.emergency.valueBRL} onChange={(v) => ms((s) => void (s.emergency.valueBRL = v))} prefix="R$" />
            </Field>
          )}
          <Field label="Aumento anual de custos até a mudança" hint="Faz a meta crescer na projeção. 0 = custos constantes.">
            <NumberInput value={sc.costIncreasePctYear} onChange={(v) => ms((s) => void (s.costIncreasePctYear = v))} max={100} suffix="% a.a." />
          </Field>
        </div>
      </Card>

      <Card
        title="Câmbio"
        subtitle="Custos em euro são convertidos para reais pelo câmbio de compra: câmbio × (1 + custo de conversão)."
        action={
          <Button
            size="sm"
            onClick={() =>
              mutate((d) => {
                for (const s of d.scenarios) s.fx = { ...sc.fx };
              })
            }
          >
            Aplicar a todos os cenários
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Câmbio (R$ por €1)" required error={sc.fx.rate <= 0 ? 'Informe o câmbio para calcular' : null}>
            <NumberInput value={sc.fx.rate} onChange={(v) => ms((s) => void (s.fx.rate = v))} prefix="R$" required />
          </Field>
          <Field label="Data da cotação" error={fxAge !== null && fxAge > settings.fxStaleDays ? `Desatualizada (${fxAge} dias)` : null}>
            <TextInput type="date" value={sc.fx.quotedAt} onChange={(e) => ms((s) => void (s.fx.quotedAt = e.target.value))} />
          </Field>
          <Field label="Fonte da cotação">
            <TextInput value={sc.fx.source} onChange={(e) => ms((s) => void (s.fx.source = e.target.value))} placeholder="Ex.: Banco Central (PTAX), casa de câmbio" />
          </Field>
          <Field label="Custo de conversão" hint="Spread + IOF + tarifas. Confirme a alíquota vigente.">
            <NumberInput value={sc.fx.conversionCostPct} onChange={(v) => ms((s) => void (s.fx.conversionCostPct = v))} max={50} suffix="%" />
          </Field>
        </div>
        {plan.valid && (
          <p className="mt-3 rounded-lg bg-areia-50 px-3 py-2 text-xs text-navy-600">
            Câmbio efetivo de compra: <strong>R$ {plan.rates.buyRate.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</strong>. Este cenário precisa de{' '}
            {money(plan.main.required.eur, 'EUR')} em euros; o cliente já tem {money(plan.main.available.eurCovered, 'EUR')} aplicados a isso. Cada R$ 0,10 de alta
            no euro aumenta a meta em <strong>{money(plan.fxImpactPer10Cents)}</strong>.
          </p>
        )}
      </Card>

      <Card title="Moradia" subtitle={HOUSING_HINTS[sc.housing.type]}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tipo de moradia" className="sm:col-span-2">
            <Select<HousingType>
              value={sc.housing.type}
              onChange={(v) => ms((s) => void (s.housing.type = v))}
              options={(Object.keys(HOUSING_LABELS) as HousingType[]).map((k) => ({ value: k, label: HOUSING_LABELS[k] }))}
            />
          </Field>
          <Field label="Aluguel mensal" hint="Parte que cabe ao cliente.">
            <NumberInput value={sc.housing.monthlyRent} onChange={(v) => ms((s) => void (s.housing.monthlyRent = v))} prefix={sc.housing.currency === 'EUR' ? '€' : 'R$'} />
          </Field>
          <Field label="Moeda do aluguel">
            <Select<Currency>
              value={sc.housing.currency}
              onChange={(v) => ms((s) => void (s.housing.currency = v))}
              options={[
                { value: 'EUR', label: 'Euro (€)' },
                { value: 'BRL', label: 'Real (R$)' },
              ]}
            />
          </Field>
          <Field label="Caução (meses de aluguel)" hint="Depósito potencialmente reembolsável.">
            <NumberInput value={sc.housing.depositMonths} onChange={(v) => ms((s) => void (s.housing.depositMonths = v))} max={12} />
          </Field>
          <Field label="Comissão de intermediação (meses)" hint="Gasto definitivo, se houver.">
            <NumberInput value={sc.housing.agencyFeeMonths} onChange={(v) => ms((s) => void (s.housing.agencyFeeMonths = v))} max={12} />
          </Field>
          <Field label="Aluguel pago antecipado (meses)" hint="Inclui o 1º mês. O que couber no período financiado não é somado de novo.">
            <NumberInput value={sc.housing.advanceRentMonths} onChange={(v) => ms((s) => void (s.housing.advanceRentMonths = v))} integer max={12} />
          </Field>
          <Field label="Situação do valor">
            <Select<ValueStatus>
              value={sc.housing.status}
              onChange={(v) => ms((s) => void (s.housing.status = v))}
              options={(Object.keys(STATUS_LABELS) as ValueStatus[]).map((k) => ({ value: k, label: STATUS_LABELS[k] }))}
            />
          </Field>
          <Field label="Fonte do aluguel" className="sm:col-span-2">
            <TextInput value={sc.housing.source} onChange={(e) => ms((s) => void (s.housing.source = e.target.value))} placeholder="Ex.: portal de imóveis, imobiliária" />
          </Field>
          <Field label="Data da consulta">
            <TextInput type="date" value={sc.housing.consultedAt} onChange={(e) => ms((s) => void (s.housing.consultedAt = e.target.value))} />
          </Field>
          <div className="flex items-end">
            <Button
              size="sm"
              onClick={() =>
                ms((s) => {
                  s.housing.monthlyRent = RENT_REFERENCE[s.housing.type][levelIdx];
                  s.housing.currency = 'EUR';
                  s.housing.source = TEMPLATE_SOURCE;
                  s.housing.consultedAt = '';
                  s.housing.status = 'sem_cotacao';
                })
              }
            >
              <RefreshCw className="h-3.5 w-3.5" /> Usar referência do modelo
            </Button>
          </div>
        </div>
      </Card>

      <Card
        title="Custos únicos da mudança"
        subtitle="Pagos uma vez, antes ou logo após a chegada. Clique em um item para editar valor, quantidade, fonte e data."
        action={
          <div className="text-right text-xs text-navy-500">
            <p>
              Definitivos: <strong className="text-navy-900">{money(plan.main.oneTimeDefinitive.totalBRL)}</strong>
            </p>
            <p>
              Depósitos: <strong className="text-navy-900">{money(plan.main.deposits.totalBRL)}</strong>
            </p>
          </div>
        }
      >
        <CostListEditor<OneTimeCost>
          kind="unico"
          items={sc.oneTimeCosts}
          lines={plan.oneTimeLines}
          onChange={(id, patch) => ms((s) => void Object.assign(s.oneTimeCosts.find((c) => c.id === id) ?? {}, patch))}
          onAdd={() => ms((s) => void s.oneTimeCosts.push(newOneTimeCost()))}
          onRemove={(id) => ms((s) => void (s.oneTimeCosts = s.oneTimeCosts.filter((c) => c.id !== id)))}
        />
        {plan.alreadyPaidBRL > 0 && <p className="mt-3 text-xs text-navy-500">Itens já pagos ({money(plan.alreadyPaidBRL)}) não entram na meta nem nos recursos.</p>}
      </Card>

      <Card
        title="Custo de vida mensal na Espanha"
        subtitle="Itens compartilhados (aluguel, internet) são fixos; itens individuais escalam por adulto, criança ou animal."
        action={
          <div className="text-right text-xs text-navy-500">
            <p>
              Por mês: <strong className="text-navy-900">{money(plan.monthlyLiving.totalBRL)}</strong>
            </p>
            <p>
              {money(plan.monthlyLiving.eur, 'EUR')} + {money(plan.monthlyLiving.brl)}
            </p>
          </div>
        }
      >
        <CostListEditor<MonthlyCost>
          kind="mensal"
          items={sc.monthlyCosts}
          lines={plan.monthlyLines}
          onChange={(id, patch) => ms((s) => void Object.assign(s.monthlyCosts.find((c) => c.id === id) ?? {}, patch))}
          onAdd={() => ms((s) => void s.monthlyCosts.push(newMonthlyCost()))}
          onRemove={(id) => ms((s) => void (s.monthlyCosts = s.monthlyCosts.filter((c) => c.id !== id)))}
        />
      </Card>

      <Card title="Renda futura na Espanha" subtitle="Renda incerta nunca é tratada como dinheiro garantido. Por padrão ela não reduz a meta.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Descrição" className="sm:col-span-2">
            <TextInput value={sc.income.description} onChange={(e) => ms((s) => void (s.income.description = e.target.value))} placeholder="Ex.: trabalho remoto, emprego com proposta" />
          </Field>
          <Field label="Valor mensal líquido">
            <NumberInput value={sc.income.monthlyAmount} onChange={(v) => ms((s) => void (s.income.monthlyAmount = v))} prefix={sc.income.currency === 'EUR' ? '€' : 'R$'} />
          </Field>
          <Field label="Moeda">
            <Select<Currency>
              value={sc.income.currency}
              onChange={(v) => ms((s) => void (s.income.currency = v))}
              options={[
                { value: 'EUR', label: 'Euro (€)' },
                { value: 'BRL', label: 'Real (R$)' },
              ]}
            />
          </Field>
          <Field label="Começa no mês" hint="1 = primeiro mês na Espanha.">
            <NumberInput value={sc.income.startMonth} onChange={(v) => ms((s) => void (s.income.startMonth = v))} integer min={1} max={36} />
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-3">
            <Toggle checked={sc.income.confirmed} onChange={(v) => ms((s) => void (s.income.confirmed = v))} label="Renda confirmada" hint="Contrato assinado ou proposta formal." />
            <Toggle
              checked={sc.income.includeInGoal}
              onChange={(v) => ms((s) => void (s.income.includeInGoal = v))}
              label="Considerar esta renda na meta"
              hint="Reduz o custo de vida financiado nos meses com renda. Gera alerta se a renda não estiver confirmada."
            />
          </div>
        </div>
        {sc.income.monthlyAmount > 0 && plan.valid && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className={cx('rounded-xl border p-3', !plan.incomeIncluded ? 'border-verde-200 bg-verde-50' : 'border-areia-200')}>
              <p className="text-xs uppercase tracking-wide text-navy-500">Meta sem renda futura</p>
              <p className="text-lg font-semibold">{money(plan.withoutIncome.required.totalBRL)}</p>
              <p className="text-xs text-navy-500">Falta: {money(plan.withoutIncome.shortfallBRL)}</p>
            </div>
            <div className={cx('rounded-xl border p-3', plan.incomeIncluded ? 'border-amber-200 bg-amber-50' : 'border-areia-200')}>
              <p className="text-xs uppercase tracking-wide text-navy-500">
                Meta com renda futura {!sc.income.confirmed && <Badge tone="warn">não confirmada</Badge>}
              </p>
              <p className="text-lg font-semibold">{money(plan.withIncome.required.totalBRL)}</p>
              <p className="text-xs text-navy-500">
                Renda considerada: {money(plan.withIncome.incomeOffset.totalBRL)} em {plan.incomeMonthsInRunway} mês(es) · Falta: {money(plan.withIncome.shortfallBRL)}
              </p>
            </div>
          </div>
        )}
      </Card>

      <Card title="Anotações do cenário">
        <TextArea value={sc.notes} onChange={(e) => ms((s) => void (s.notes = e.target.value))} placeholder="Justificativas das premissas, fontes gerais, decisões." />
      </Card>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Novo cenário a partir do modelo">
        <p className="mb-3 text-sm text-navy-500">Cria um cenário com os valores de partida do modelo (sem cotação) para a composição atual do cliente.</p>
        <div className="flex flex-col gap-2">
          {(['economico', 'intermediario', 'conservador'] as const).map((lvl) => (
            <Button
              key={lvl}
              className="justify-start"
              onClick={() => {
                mutate((d) => {
                  const s = buildScenario(
                    lvl,
                    { profile: d.profile, pets: d.personal.pets, children: d.personal.children, ticketsBought: d.move.ticketsBought, needsTempLodging: d.move.needsTempLodging },
                    sc.fx.rate > 0 ? sc.fx : settings.defaultFx,
                  );
                  s.name = `${LEVEL_LABELS[lvl]} ${d.scenarios.filter((x) => x.level === lvl).length + 1}`;
                  d.scenarios.push(s);
                  d.selectedScenarioId = s.id;
                });
                setNewOpen(false);
              }}
            >
              <span className="font-semibold">{LEVEL_LABELS[lvl]}</span> <span className="text-xs text-navy-500">— {LEVEL_HINTS[lvl]}</span>
            </Button>
          ))}
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Excluir o cenário “${sc.name}”?`}
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => {
                mutate((d) => {
                  d.scenarios = d.scenarios.filter((x) => x.id !== sc.id);
                  d.selectedScenarioId = d.scenarios[0].id;
                });
                setDeleteOpen(false);
              }}
            >
              Excluir cenário
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-600">As premissas e cotações deste cenário serão perdidas.</p>
      </Modal>
    </div>
  );
}
