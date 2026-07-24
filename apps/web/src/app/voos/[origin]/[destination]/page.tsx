import type { Metadata } from "next";
import Link from "next/link";
import { Plane, TrendingDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PublicPriceChart } from "@/components/public/public-price-chart";
import { getRouteHistory } from "@/lib/api/price-monitoring";
import { formatCurrencyCents } from "@/lib/utils";
import type { PriceHistory } from "@/lib/api/types";

export const revalidate = 3600; // ISR: recalcula a página no máximo 1x por hora

interface RouteParams {
  params: { origin: string; destination: string };
}

function normalizeParams({ origin, destination }: { origin: string; destination: string }) {
  return { origin: origin.toUpperCase(), destination: destination.toUpperCase() };
}

async function fetchHistorySafely(origin: string, destination: string): Promise<PriceHistory | null> {
  try {
    return await getRouteHistory(origin, destination, "economy", 30);
  } catch {
    // Não deixamos um erro de rede virar página de erro/404 — para SEO, uma página
    // "ainda sem dado, mas monitoramos se você criar o alerta" vale muito mais do
    // que uma 5xx que o Google pode penalizar na indexação.
    return null;
  }
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { origin, destination } = normalizeParams(params);
  const history = await fetchHistorySafely(origin, destination);

  const priceHint =
    history?.min_price_cents != null
      ? ` a partir de ${formatCurrencyCents(history.min_price_cents, "BRL")}`
      : "";

  const title = `Passagens ${origin} → ${destination}${priceHint} | TripRadar AI`;
  const description = `Acompanhe o histórico de preço de passagens aéreas de ${origin} para ${destination} e crie um alerta gratuito para saber a hora certa de comprar.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function RoutePage({ params }: RouteParams) {
  const { origin, destination } = normalizeParams(params);
  const history = await fetchHistorySafely(origin, destination);
  const hasData = Boolean(history && history.snapshots.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          {origin}
          <Plane className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          {destination}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Histórico de preço e recomendação de quando comprar para esta rota.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preço nos últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasData || !history ? (
            <EmptyState
              icon={<TrendingDown className="h-8 w-8" aria-hidden="true" />}
              title="Ainda não monitoramos esta rota"
              description="Crie um alerta gratuito e a gente começa a acompanhar o preço para você."
              action={
                <Button asChild>
                  <Link href={`/registro?origin=${origin}&destination=${destination}`}>
                    Criar alerta grátis para {origin} → {destination}
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Mínimo</p>
                  <p className="text-lg font-semibold">
                    {history.min_price_cents !== null ? formatCurrencyCents(history.min_price_cents) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Média</p>
                  <p className="text-lg font-semibold">
                    {history.avg_price_cents !== null ? formatCurrencyCents(history.avg_price_cents) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Máximo</p>
                  <p className="text-lg font-semibold">
                    {history.max_price_cents !== null ? formatCurrencyCents(history.max_price_cents) : "—"}
                  </p>
                </div>
              </div>

              <div
                role="img"
                aria-label={`Histórico de preço de ${origin} para ${destination} nos últimos 30 dias: mínimo ${
                  history.min_price_cents !== null ? formatCurrencyCents(history.min_price_cents) : "sem dado"
                }, média ${
                  history.avg_price_cents !== null ? formatCurrencyCents(history.avg_price_cents) : "sem dado"
                }, máximo ${
                  history.max_price_cents !== null ? formatCurrencyCents(history.max_price_cents) : "sem dado"
                }.`}
              >
                <PublicPriceChart snapshots={history.snapshots} currency="BRL" />
              </div>

              <div className="flex justify-center border-t border-border pt-6">
                <Button asChild size="lg">
                  <Link href={`/registro?origin=${origin}&destination=${destination}`}>
                    Criar alerta grátis para esta rota
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
