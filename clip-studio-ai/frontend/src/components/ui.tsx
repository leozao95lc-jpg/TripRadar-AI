"use client";
import { ReactNode, useEffect, useState } from "react";
import { STATUS } from "@/lib/api";

const TONES = {
  muted: "bg-raised text-muted border-line",
  orange: "bg-orange/15 text-orange border-orange/40",
  gold: "bg-gold/15 text-gold border-gold/40",
  green: "bg-green text-cream border-green-soft",
  danger: "bg-danger/15 text-danger border-danger/40",
};

export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  const s = status ? STATUS[status] : undefined;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${TONES[s?.tone ?? "muted"]}`}>
      {children ?? s?.label ?? status}
    </span>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "green" | "danger"; small?: boolean };
export function Button({ variant = "ghost", small, className = "", ...p }: BtnProps) {
  const v = {
    primary: "bg-orange text-bg hover:brightness-110 font-semibold",
    green: "bg-green text-cream hover:bg-green-soft border border-green-soft",
    ghost: "bg-raised text-cream hover:bg-line border border-line",
    danger: "bg-transparent text-danger hover:bg-danger/15 border border-danger/40",
  }[variant];
  return <button {...p} className={`rounded-lg ${small ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm"} transition disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`} />;
}

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Progress({ value, tone = "orange" }: { value: number; tone?: "orange" | "green" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={Math.round(value * 100)}>
      <div className={`h-full rounded-full transition-all duration-500 ${tone === "green" ? "bg-green-soft" : "bg-orange"}`} style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-line bg-surface p-5" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-xl font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>;
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold ${accent ? "text-orange" : ""}`}>{value}</p>
    </div>
  );
}

/** Carrega dados e expõe reload; erros viram mensagem legível. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = () => loader().then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);
  return { data, error, reload, setData };
}
