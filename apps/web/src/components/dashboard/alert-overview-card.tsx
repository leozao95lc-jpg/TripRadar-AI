import Link from "next/link";
import { Plane } from "lucide-react";

import { CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TripScoreBadge } from "@/components/alerts/trip-score-badge";
import { useRecommendation } from "@/hooks/use-recommendation";
import { formatCurrencyCents, formatDate } from "@/lib/utils";
import type { SearchAlert } from "@/lib/api/types";

export function AlertOverviewCard({ alert }: { alert: SearchAlert }) {
  const { data: score, isLoading } = useRecommendation(alert.id);

  return (
    <Link href={`/alerts/${alert.id}`} className="block focus-visible:outline-none">
      <article
        aria-label={`Alerta ${alert.origin_iata} para ${alert.destination_iata}`}
        className={cn(
          "h-full rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-colors",
          "hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <div className="flex items-center gap-1.5 text-base font-semibold">
              {alert.origin_iata}
              <Plane className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {alert.destination_iata}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDate(alert.departure_date)}
              {alert.return_date ? ` – ${formatDate(alert.return_date)}` : " · só ida"}
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="h-5 w-28" aria-hidden="true" />
          ) : score ? (
            <TripScoreBadge verdict={score.verdict} />
          ) : (
            <Badge variant="neutral">Aguardando 1ª coleta</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-xs text-muted-foreground">Alvo de preço</p>
          <p className="text-lg font-semibold">
            {formatCurrencyCents(alert.max_price_cents, alert.currency)}
          </p>
          {score ? (
            <p className="text-sm text-muted-foreground">
              Preço atual: {formatCurrencyCents(score.current_price_cents, alert.currency)}
            </p>
          ) : null}
        </CardContent>
      </article>
    </Link>
  );
}
