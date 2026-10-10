// Utilitários de mês ('YYYY-MM') e data ('YYYY-MM-DD'), sem dependência de fuso.

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function isValidMonth(ym: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
}

export function parseMonth(ym: string): { y: number; m: number } {
  const [y, m] = ym.split('-').map(Number);
  return { y, m };
}

export function addMonths(ym: string, n: number): string {
  const { y, m } = parseMonth(ym);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/** Número de meses de `from` até `to` (to - from). */
export function diffMonths(from: string, to: string): number {
  const a = parseMonth(from);
  const b = parseMonth(to);
  return (b.y - a.y) * 12 + (b.m - a.m);
}

export function monthLabel(ym: string): string {
  if (!isValidMonth(ym)) return '—';
  const { y, m } = parseMonth(ym);
  return `${MONTHS_PT[m - 1]}/${y}`;
}

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentMonth(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function isValidDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Dias entre duas datas ISO (b - a). Retorna null se alguma for inválida. */
export function daysBetween(a: string, b: string): number | null {
  if (!isValidDate(a) || !isValidDate(b)) return null;
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function dateLabel(iso: string): string {
  if (!isValidDate(iso)) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
