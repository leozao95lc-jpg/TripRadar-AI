import clsx from 'clsx';
import { AlertTriangle, Info, OctagonAlert, X } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import type { AlertSeverity, PlanAlert } from '../domain/analysis';

export function cx(...args: Parameters<typeof clsx>) {
  return clsx(...args);
}

export function Card({ children, className, title, action, subtitle }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-areia-200 bg-white shadow-sm', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-areia-100 px-5 py-4">
          <div>
            {title && <h3 className="text-base font-semibold text-navy-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-sm text-navy-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-verde-400 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variant === 'primary' && 'bg-navy-800 text-white hover:bg-navy-700',
        variant === 'success' && 'bg-verde-600 text-white hover:bg-verde-700',
        variant === 'secondary' && 'border border-areia-300 bg-white text-navy-800 hover:bg-areia-50',
        variant === 'ghost' && 'text-navy-600 hover:bg-areia-100',
        variant === 'danger' && 'border border-terra-100 bg-terra-50 text-terra-700 hover:bg-terra-100',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-navy-800">
        {label}
        {required && <span className="ml-0.5 text-terra-600" title="Obrigatório">*</span>}
      </label>
      {children}
      {error ? <p className="text-xs font-medium text-terra-600">{error}</p> : hint ? <p className="text-xs text-navy-500">{hint}</p> : null}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-areia-300 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-300 focus:border-verde-500 focus:outline-none focus:ring-2 focus:ring-verde-100';

export function TextInput({ className, invalid, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...props} className={cx(inputCls, invalid && 'border-terra-500 focus:border-terra-500 focus:ring-terra-100', className)} />;
}

export function TextArea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputCls, 'resize-y', className)} />;
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
  id,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  id?: string;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={cx(inputCls, 'pr-8', className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Converte texto digitado em número aceitando formato brasileiro (1.234,56) ou ponto decimal (6.3). */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/\s/g, '').replace(/^R\$|€/g, '');
  if (t === '') return null;
  let normalized: string;
  if (t.includes(',')) normalized = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) normalized = t.replace(/\./g, '');
  else normalized = t;
  if (!/^-?\d*\.?\d+$/.test(normalized)) return NaN;
  return Number(normalized);
}

function formatForEdit(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 4, useGrouping: false });
}

export function NumberInput({
  value,
  onChange,
  allowNegative = false,
  required = false,
  integer = false,
  min,
  max,
  suffix,
  prefix,
  className,
  id,
  placeholder,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  allowNegative?: boolean;
  required?: boolean;
  integer?: boolean;
  min?: number;
  max?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  id?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(formatForEdit(value));
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!focused) setText(formatForEdit(value));
  }, [value, focused]);

  const validate = (t: string): { ok: boolean; n: number; msg: string | null } => {
    const n = parseNumber(t);
    if (n === null) return required ? { ok: false, n: 0, msg: 'Campo obrigatório' } : { ok: true, n: 0, msg: null };
    if (Number.isNaN(n)) return { ok: false, n: 0, msg: 'Número inválido' };
    if (!allowNegative && n < 0) return { ok: false, n: 0, msg: 'Não pode ser negativo' };
    if (integer && !Number.isInteger(n)) return { ok: false, n: 0, msg: 'Use um número inteiro' };
    if (min !== undefined && n < min) return { ok: false, n: 0, msg: `Mínimo: ${min}` };
    if (max !== undefined && n > max) return { ok: false, n: 0, msg: `Máximo: ${max}` };
    return { ok: true, n, msg: null };
  };

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <div className="relative flex items-center">
        {prefix && <span className="pointer-events-none absolute left-3 text-sm text-navy-400">{prefix}</span>}
        <input
          id={id}
          aria-label={ariaLabel}
          inputMode="decimal"
          placeholder={placeholder}
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const r = validate(text);
            if (!r.ok) setError(r.msg);
            else setText(formatForEdit(r.n));
          }}
          onChange={(e) => {
            setText(e.target.value);
            const r = validate(e.target.value);
            setError(r.msg);
            if (r.ok) onChange(r.n);
          }}
          className={cx(inputCls, 'text-right tabular-nums', prefix && 'pl-9', suffix && 'pr-12', error && 'border-terra-500 focus:border-terra-500 focus:ring-terra-100')}
        />
        {suffix && <span className="pointer-events-none absolute right-3 text-xs text-navy-400">{suffix}</span>}
      </div>
      {error && <p className="text-xs font-medium text-terra-600">{error}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-verde-500' : 'bg-areia-300')}
      >
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition', checked ? 'left-4' : 'left-0.5')} />
      </button>
      <label htmlFor={id} className="cursor-pointer text-sm">
        <span className="font-medium text-navy-800">{label}</span>
        {hint && <span className="block text-xs text-navy-500">{hint}</span>}
      </label>
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'green' | 'navy' | 'warn' | 'danger'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'bg-areia-100 text-navy-700',
        tone === 'green' && 'bg-verde-50 text-verde-700',
        tone === 'navy' && 'bg-navy-50 text-navy-700',
        tone === 'warn' && 'bg-amber-50 text-amber-800',
        tone === 'danger' && 'bg-terra-50 text-terra-700',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
  help,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'green' | 'warn' | 'danger' | 'navy';
  help?: string;
}) {
  return (
    <div
      title={help}
      className={cx(
        'rounded-xl border p-4',
        tone === 'default' && 'border-areia-200 bg-white',
        tone === 'green' && 'border-verde-100 bg-verde-50',
        tone === 'warn' && 'border-amber-100 bg-amber-50',
        tone === 'danger' && 'border-terra-100 bg-terra-50',
        tone === 'navy' && 'border-navy-800 bg-navy-800 text-white',
      )}
    >
      <p className={cx('text-xs font-medium uppercase tracking-wide', tone === 'navy' ? 'text-navy-200' : 'text-navy-500')}>{label}</p>
      <p className={cx('mt-1 text-xl font-semibold tabular-nums', tone === 'navy' ? 'text-white' : 'text-navy-900')}>{value}</p>
      {sub && <p className={cx('mt-0.5 text-xs', tone === 'navy' ? 'text-navy-200' : 'text-navy-500')}>{sub}</p>}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={cx('h-2.5 w-full overflow-hidden rounded-full bg-areia-200', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-verde-500 transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}

const SEVERITY_STYLE: Record<AlertSeverity, { cls: string; icon: ReactNode; label: string }> = {
  critico: { cls: 'border-terra-100 bg-terra-50 text-terra-700', icon: <OctagonAlert className="h-4 w-4" />, label: 'Crítico' },
  atencao: { cls: 'border-amber-100 bg-amber-50 text-amber-800', icon: <AlertTriangle className="h-4 w-4" />, label: 'Atenção' },
  info: { cls: 'border-navy-100 bg-navy-50 text-navy-700', icon: <Info className="h-4 w-4" />, label: 'Informação' },
};

export function AlertList({ alerts, compact = false }: { alerts: PlanAlert[]; compact?: boolean }) {
  if (alerts.length === 0) return <p className="text-sm text-navy-500">Nenhum alerta para este cenário.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((a) => {
        const s = SEVERITY_STYLE[a.severity];
        return (
          <li key={a.id} className={cx('flex gap-2.5 rounded-lg border px-3 py-2.5', s.cls)}>
            <span className="mt-0.5 shrink-0" aria-label={s.label}>
              {s.icon}
            </span>
            <div>
              <p className="text-sm font-semibold">{a.title}</p>
              {!compact && <p className="mt-0.5 text-xs leading-relaxed opacity-90">{a.detail}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-areia-100 px-5 py-4">
          <h3 className="font-semibold text-navy-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-navy-400 hover:bg-areia-100" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-areia-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex min-w-full gap-1 border-b border-areia-200">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cx(
              '-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition',
              value === t.value ? 'border-verde-500 text-navy-900' : 'border-transparent text-navy-500 hover:text-navy-800',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-areia-300 bg-white px-6 py-12 text-center">
      <p className="font-semibold text-navy-900">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-navy-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-semibold text-navy-900">{children}</h2>
      {sub && <p className="text-sm text-navy-500">{sub}</p>}
    </div>
  );
}
