"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plane } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteAlertDialog } from "@/components/alerts/delete-alert-dialog";
import { TripScorePanel } from "@/components/alerts/trip-score-panel";
import { PriceHistoryChart } from "@/components/alerts/price-history-chart";
import { useAlert, useAlerts } from "@/hooks/use-alerts";
import { formatCurrencyCents, formatDate } from "@/lib/utils";

const CABIN_CLASS_LABEL: Record<string, string> = {
  economy: "Econômica",
  premium_economy: "Premium Economy",
  business: "Executiva",
  first: "Primeira Classe",
};

export default function AlertDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { isLoading: isLoadingAlerts, isError } = useAlerts();
  const { data: alert } = useAlert(params.id);

  if (isLoadingAlerts) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Não foi possível carregar este alerta"
        description="Tente novamente em instantes."
        action={
          <Button variant="outline" onClick={() => router.refresh()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  if (!alert) {
    return (
      <EmptyState
        title="Alerta não encontrado"
        description="Ele pode ter sido excluído, ou o link está incorreto."
        action={
          <Button asChild variant="outline">
            <Link href="/alerts">Voltar para meus alertas</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/alerts"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Meus alertas
        </Link>
        <DeleteAlertDialog
          alert={alert}
          onDeleted={() => router.push("/alerts")}
          trigger={
            <Button variant="outline" size="sm">
              Excluir alerta
            </Button>
          }
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              {alert.origin_iata}
              <Plane className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {alert.destination_iata}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(alert.departure_date)}
              {alert.return_date ? ` – ${formatDate(alert.return_date)}` : " · só ida"}
              {alert.flexible_dates ? " · datas flexíveis" : ""}
            </p>
          </div>
          <Badge variant={alert.status === "active" ? "success" : "neutral"}>
            {alert.status === "active" ? "Ativo" : alert.status}
          </Badge>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Alvo de preço</dt>
              <dd className="font-semibold">{formatCurrencyCents(alert.max_price_cents, alert.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Classe</dt>
              <dd className="font-semibold">{CABIN_CLASS_LABEL[alert.cabin_class] ?? alert.cabin_class}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Passageiros</dt>
              <dd className="font-semibold">{alert.passengers}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Escalas máx.</dt>
              <dd className="font-semibold">{alert.max_stops ?? "Sem limite"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <TripScorePanel alertId={alert.id} currency={alert.currency} />

      <PriceHistoryChart
        originIata={alert.origin_iata}
        destinationIata={alert.destination_iata}
        cabinClass={alert.cabin_class}
        currency={alert.currency}
      />
    </div>
  );
}
