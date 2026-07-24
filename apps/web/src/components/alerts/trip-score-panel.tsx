"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TripScoreBadge } from "@/components/alerts/trip-score-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRecommendation } from "@/hooks/use-recommendation";
import { formatCurrencyCents } from "@/lib/utils";
import { Info } from "lucide-react";

const TREND_LABEL: Record<string, string> = {
  up: "Subindo",
  down: "Caindo",
  stable: "Estável",
};

const CURRENCY_SIGNAL_LABEL: Record<string, string> = {
  favorable: "Câmbio favorável",
  unfavorable: "Câmbio desfavorável",
  stable: "Câmbio estável",
  unknown: "Sem dado de câmbio",
};

export function TripScorePanel({ alertId, currency }: { alertId: string; currency: string }) {
  const { data: score, isLoading } = useRecommendation(alertId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recomendação da IA (TripScore)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" aria-hidden="true">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !score ? (
          <EmptyState
            title="Aguardando a primeira coleta de preço"
            description="Assim que o motor de monitoramento capturar o primeiro preço desta rota, a recomendação aparece aqui."
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <TripScoreBadge verdict={score.verdict} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1 text-sm text-muted-foreground">
                    Confiança {Math.round(score.confidence * 100)}%
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Quanto mais próximo de 100%, mais o histórico da rota sustenta esta recomendação.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <p className="text-sm leading-relaxed">{score.explanation}</p>

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Preço atual</p>
                <p className="font-semibold">{formatCurrencyCents(score.current_price_cents, currency)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Menor preço já visto</p>
                <p className="font-semibold">{formatCurrencyCents(score.target_price_cents, currency)}</p>
              </div>
              {score.factors.trend_7d ? (
                <div>
                  <p className="text-xs text-muted-foreground">Tendência recente</p>
                  <p className="font-semibold">{TREND_LABEL[score.factors.trend_7d] ?? score.factors.trend_7d}</p>
                </div>
              ) : null}
              {score.factors.currency_signal ? (
                <div>
                  <p className="text-xs text-muted-foreground">Câmbio</p>
                  <p className="font-semibold">
                    {CURRENCY_SIGNAL_LABEL[score.factors.currency_signal] ?? score.factors.currency_signal}
                  </p>
                </div>
              ) : null}
            </div>

            {score.factors.mileage_comparison && score.factors.mileage_comparison.length > 0 ? (
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Ou resgate com milhas (estimativa)</p>
                <ul className="space-y-1 text-sm">
                  {score.factors.mileage_comparison.map((program) => (
                    <li key={program.program} className="flex justify-between">
                      <span>{program.program}</span>
                      <span className="font-medium">{program.estimated_miles.toLocaleString("pt-BR")} milhas</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
