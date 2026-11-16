"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/api";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projetos" },
  { href: "/settings", label: "Canal e legendas" },
];

export default function Shell({ title, subtitle, action, children }: { title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    api("/auth/me").then(() => setReady(true)).catch(() => router.replace("/login"));
  }, [router]);
  if (!ready) return <div className="grid h-screen place-items-center font-mono text-sm text-muted">Carregando…</div>;
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href) || (href === "/projects" && path.startsWith("/videos")));
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line bg-surface p-4">
        <Link href="/" className="mb-8 block">
          <span className="font-display text-xl font-extrabold leading-none">CLIP STUDIO <span className="text-orange">AI</span></span>
          <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-muted">cortes verticais</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`rounded-lg px-3 py-2 text-sm transition ${active(n.href) ? "bg-green text-cream" : "text-muted hover:bg-raised hover:text-cream"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <button onClick={() => api("/auth/logout", { method: "POST" }).then(() => router.replace("/login"))} className="rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-raised hover:text-cream">
          Sair
        </button>
      </aside>
      <main className="min-w-0 flex-1 p-6 lg:p-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold">{title}</h1>
            {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
          </div>
          {action}
        </header>
        {children}
      </main>
    </div>
  );
}
