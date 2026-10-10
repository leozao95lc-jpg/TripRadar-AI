import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { LineResult } from '../domain/calc';
import {
  MONTHLY_CATEGORY_LABELS,
  NATURE_LABELS,
  ONE_TIME_CATEGORY_LABELS,
  SCALING_LABELS,
  SCALING_SHORT,
  STATUS_LABELS,
} from '../domain/labels';
import type { Currency, MonthlyCategory, MonthlyCost, OneTimeCategory, OneTimeCost, OneTimeNature, Scaling, ValueStatus } from '../domain/types';
import { dateLabel, isValidDate } from '../lib/dates';
import { money } from '../lib/format';
import { Badge, Button, Field, NumberInput, Select, TextInput, Toggle, cx } from './ui';

type Item = OneTimeCost | MonthlyCost;

const statusTone = (s: ValueStatus) => (s === 'confirmado' ? 'green' : s === 'estimado' ? 'navy' : 'warn');

export function StatusBadge({ status, consultedAt }: { status: ValueStatus; consultedAt: string }) {
  return (
    <Badge tone={statusTone(status)}>
      {STATUS_LABELS[status]}
      {isValidDate(consultedAt) && status !== 'sem_cotacao' ? ` · ${dateLabel(consultedAt)}` : ''}
    </Badge>
  );
}

export default function CostListEditor<T extends Item>({
  kind,
  items,
  lines,
  onChange,
  onAdd,
  onRemove,
}: {
  kind: 'unico' | 'mensal';
  items: T[];
  lines: LineResult[];
  onChange: (id: string, patch: Partial<T>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const derived = lines.filter((l) => l.derived);
  const categories = kind === 'unico' ? ONE_TIME_CATEGORY_LABELS : MONTHLY_CATEGORY_LABELS;

  return (
    <div>
      <div className="hidden grid-cols-[1fr_120px_130px_120px_110px] gap-3 border-b border-areia-200 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-navy-500 md:grid">
        <span>Item</span>
        <span className="text-right">Valor unitário</span>
        <span className="text-right">Quantidade</span>
        <span className="text-right">Subtotal</span>
        <span className="text-right">Situação</span>
      </div>
      <ul className="divide-y divide-areia-100">
        {derived.map((l) => (
          <li key={l.id} className="grid grid-cols-2 gap-x-3 gap-y-1 bg-areia-50/70 px-3 py-2.5 text-sm md:grid-cols-[1fr_120px_130px_120px_110px] md:items-center">
            <div className="col-span-2 md:col-span-1">
              <p className="font-medium text-navy-900">{l.name}</p>
              <p className="text-xs text-navy-500">
                Calculado: {l.formula}
                {l.nature && ` · ${NATURE_LABELS[l.nature]}`}
              </p>
            </div>
            <span className="text-right tabular-nums text-navy-600">{money(l.unitValue, l.currency)}</span>
            <span className="text-right text-xs text-navy-500">{l.effectiveQty}</span>
            <span className="text-right font-medium tabular-nums">{money(l.subtotal, l.currency)}</span>
            <span className="text-right">
              <StatusBadge status={l.status} consultedAt={l.consultedAt} />
            </span>
          </li>
        ))}
        {items.map((item) => {
          const line = lineById.get(item.id);
          const isOpen = open === item.id;
          const ot = kind === 'unico' ? (item as OneTimeCost) : null;
          return (
            <li key={item.id} className={cx(ot?.alreadyPaid && 'opacity-60')}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : item.id)}
                className="grid w-full grid-cols-2 gap-x-3 gap-y-1 px-3 py-2.5 text-left text-sm hover:bg-areia-50 md:grid-cols-[1fr_120px_130px_120px_110px] md:items-center"
              >
                <div className="col-span-2 flex items-start gap-1.5 md:col-span-1">
                  {isOpen ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{item.name || 'Sem nome'}</p>
                    <p className="text-xs text-navy-500">
                      {categories[item.category as keyof typeof categories]}
                      {ot && ` · ${NATURE_LABELS[ot.nature]}`}
                      {ot?.alreadyPaid && ' · já pago'}
                    </p>
                  </div>
                </div>
                <span className="text-right tabular-nums text-navy-600">{money(item.unitValue, item.currency, true)}</span>
                <span className="text-right text-xs text-navy-500">
                  {item.quantity} {SCALING_SHORT[item.scaling]} = {line?.effectiveQty ?? 0}
                </span>
                <span className="text-right font-medium tabular-nums">{money(line?.subtotal ?? 0, item.currency)}</span>
                <span className="text-right">
                  <StatusBadge status={item.status} consultedAt={item.consultedAt} />
                </span>
              </button>
              {isOpen && (
                <div className="grid gap-3 border-t border-areia-100 bg-areia-50 px-3 py-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Nome" className="sm:col-span-2">
                    <TextInput value={item.name} onChange={(e) => onChange(item.id, { name: e.target.value } as Partial<T>)} />
                  </Field>
                  <Field label="Categoria">
                    <Select
                      value={item.category as string}
                      onChange={(v) => onChange(item.id, { category: v as OneTimeCategory & MonthlyCategory } as Partial<T>)}
                      options={Object.entries(categories).map(([value, label]) => ({ value, label }))}
                    />
                  </Field>
                  {ot ? (
                    <Field label="Natureza" hint="Depósitos aparecem separados dos gastos definitivos.">
                      <Select<OneTimeNature>
                        value={ot.nature}
                        onChange={(v) => onChange(item.id, { nature: v } as unknown as Partial<T>)}
                        options={(Object.keys(NATURE_LABELS) as OneTimeNature[]).map((k) => ({ value: k, label: NATURE_LABELS[k] }))}
                      />
                    </Field>
                  ) : (
                    <div />
                  )}
                  <Field label="Valor unitário">
                    <NumberInput value={item.unitValue} onChange={(v) => onChange(item.id, { unitValue: v } as Partial<T>)} prefix={item.currency === 'EUR' ? '€' : 'R$'} />
                  </Field>
                  <Field label="Moeda">
                    <Select<Currency>
                      value={item.currency}
                      onChange={(v) => onChange(item.id, { currency: v } as Partial<T>)}
                      options={[
                        { value: 'EUR', label: 'Euro (€)' },
                        { value: 'BRL', label: 'Real (R$)' },
                      ]}
                    />
                  </Field>
                  <Field label="Quantidade" hint={kind === 'unico' && item.category === 'hospedagem_temporaria' ? 'Número de noites.' : undefined}>
                    <NumberInput value={item.quantity} onChange={(v) => onChange(item.id, { quantity: v } as Partial<T>)} />
                  </Field>
                  <Field label="Multiplicar por" hint="Itens compartilhados devem ser fixos.">
                    <Select<Scaling>
                      value={item.scaling}
                      onChange={(v) => onChange(item.id, { scaling: v } as Partial<T>)}
                      options={(Object.keys(SCALING_LABELS) as Scaling[]).map((k) => ({ value: k, label: SCALING_LABELS[k] }))}
                    />
                  </Field>
                  <Field label="Situação do valor">
                    <Select<ValueStatus>
                      value={item.status}
                      onChange={(v) => onChange(item.id, { status: v } as Partial<T>)}
                      options={(Object.keys(STATUS_LABELS) as ValueStatus[]).map((k) => ({ value: k, label: STATUS_LABELS[k] }))}
                    />
                  </Field>
                  <Field label="Fonte do valor" hint="Site, imobiliária, companhia aérea, experiência própria…" className="sm:col-span-2">
                    <TextInput value={item.source} onChange={(e) => onChange(item.id, { source: e.target.value } as Partial<T>)} />
                  </Field>
                  <Field label="Data da consulta">
                    <TextInput type="date" value={item.consultedAt} onChange={(e) => onChange(item.id, { consultedAt: e.target.value } as Partial<T>)} />
                  </Field>
                  <Field label="Observação" className="sm:col-span-2 lg:col-span-4">
                    <TextInput value={item.note} onChange={(e) => onChange(item.id, { note: e.target.value } as Partial<T>)} />
                  </Field>
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
                    {ot ? (
                      <Toggle
                        checked={ot.alreadyPaid}
                        onChange={(v) => onChange(item.id, { alreadyPaid: v } as unknown as Partial<T>)}
                        label="Já pago"
                        hint="Sai da meta e não conta como recurso disponível (evita contagem dupla)."
                      />
                    ) : (
                      <span />
                    )}
                    <Button variant="danger" size="sm" onClick={() => onRemove(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Remover item
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3">
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" /> Adicionar {kind === 'unico' ? 'custo único' : 'custo mensal'}
        </Button>
      </div>
    </div>
  );
}
