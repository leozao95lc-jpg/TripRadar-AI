import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              T
            </span>
            TripRadar AI
          </Link>
          <nav className="flex items-center gap-2 text-sm font-medium">
            <Link href="/login" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">
              Entrar
            </Link>
            <Link
              href="/registro"
              className="rounded-md bg-primary px-3 py-2 text-primary-foreground hover:opacity-90"
            >
              Criar conta grátis
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        TripRadar AI — monitoramento inteligente de passagens aéreas.
      </footer>
    </div>
  );
}
