"use client";

import Link from "next/link";
import { Bell, Plane, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteAlertDialog } from "@/components/alerts/delete-alert-dialog";
import { useAlerts } from "@/hooks/use-alerts";
import { formatCurrencyCents, formatDate } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  archived: "Arquivado",
};

export default function AlertsListPage() {
  const { data: alerts, isLoading, isError, refetch, isFetching } = useAlerts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Meus alertas</h1>
        <Button asChild>
          <Link href="/alerts/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Criar alerta
          </Link>
        </Button>
      </div>

      {isError ? (
        <Alert
          variant="destructive"
          role="alert"
          className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>Não foi possível carregar seus alertas agora.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching}>
            Tentar novamente
          </Button>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-3" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !alerts || alerts.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-8 w-8" aria-hidden="true" />}
          title="Você ainda não tem alertas"
          description="Crie um alerta para uma rota e a gente avisa quando o preço cair."
          action={
            <Button asChild>
              <Link href="/alerts/new">Criar meu primeiro alerta</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {alerts.map((alert) => (
                <li key={alert.id} className="flex items-center gap-4 p-4">
                  <Link
                    href={`/alerts/${alert.id}`}
                    className="flex flex-1 items-center gap-4 focus-visible:outline-none"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Plane className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">
                          {alert.origin_iata} → {alert.destination_iata}
                        </span>
                        <Badge variant={alert.status === "active" ? "success" : "neutral"}>
                          {STATUS_LABEL[alert.status] ?? alert.status}
                        </Badge>
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {formatDate(alert.departure_date)}
                        {alert.return_date ? ` – ${formatDate(alert.return_date)}` : " · só ida"} · até{" "}
                        {formatCurrencyCents(alert.max_price_cents, alert.currency)}
                      </span>
                    </span>
                  </Link>
                  <DeleteAlertDialog alert={alert} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
