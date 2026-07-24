"use client";

import { TrendingDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useDashboardActivity } from "@/hooks/use-dashboard-activity";
import { formatCurrencyCents, formatDateTime } from "@/lib/utils";

// Fonte de dado mockada — ver lib/api/dashboard-activity.ts para o porquê e como
// substituir quando o backend expuser um feed real de disparos de alerta.
export function RecentActivity() {
  const { data, isLoading } = useDashboardActivity(5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade recente</CardTitle>
        <p className="text-xs text-muted-foreground">
          Prévia com dado de exemplo — o feed real de quedas de preço ainda não tem endpoint no backend.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" aria-hidden="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState title="Nenhuma atividade ainda" description="Assim que um alerta disparar, ele aparece aqui." />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <TrendingDown className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.originIata} → {item.destinationIata}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(item.triggeredAt)}</p>
                </div>
                <p className="text-sm font-semibold">{formatCurrencyCents(item.priceCents, item.currency)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
