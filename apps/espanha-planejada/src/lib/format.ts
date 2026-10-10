import type { Currency } from '../domain/types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brlCents = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const eur = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurCents = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function money(value: number, currency: Currency = 'BRL', cents = false): string {
  if (!Number.isFinite(value)) return '—';
  if (currency === 'EUR') return (cents ? eurCents : eur).format(value);
  return (cents ? brlCents : brl).format(value);
}

export function number(value: number): string {
  return Number.isFinite(value) ? num.format(value) : '—';
}

export function pct(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}

/** Arredonda para centavos evitando ruído de ponto flutuante. */
export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
