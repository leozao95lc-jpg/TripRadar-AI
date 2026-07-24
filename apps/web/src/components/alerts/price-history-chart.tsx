"use client";

import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { usePriceHistory } from "@/hooks/use-price-history";
import { formatCurrencyCents, formatDate } from "@/lib/utils";
import type { CabinClass } from "@/lib/api/types";

const RANGE_OPTIONS = [
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
] as const;

export function PriceHistoryChart({
  originIata,
  destinationIata,
  cabinClass,
  currency,
}: {
  originIata: string;
  destinationIata: string;
  cabinClass: CabinClass;
  currency: string;
}) {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const { data, isLoading, isError, refetch } = usePriceHistory(originIata, destinationIata, cabinClass, rangeDays);

  const chartData =
    data?.snapshots.map((snapshot) => ({
      date: snapshot.collected_at,
      price: snapshot.price_cents / 100,
    })) ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Histórico de preço</CardTitle>
        <div className="flex gap-1" role="group" aria-label="Período do histórico">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRangeDays(option.value)}
              aria-pressed={rangeDays === option.value}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                rangeDays === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isError ? (
          <Alert variant="destructive" role="alert" className="justify-between">
            <span>Não foi possível carregar o histórico.</span>
            <button onClick={() => refetch()} className="font-medium underline">
              Tentar novamente
            </button>
          </Alert>
        ) : isLoading ? (
          <Skeleton className="h-64 w-full" aria-hidden="true" />
        ) : !data || data.snapshots.length === 0 ? (
          <EmptyState
            title="Ainda sem histórico"
            description="O motor de monitoramento ainda não coletou preços suficientes para esta rota."
          />
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Mínimo</p>
                <p className="text-sm font-semibold">
                  {data.min_price_cents !== null ? formatCurrencyCents(data.min_price_cents, currency) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Média</p>
                <p className="text-sm font-semibold">
                  {data.avg_price_cents !== null ? formatCurrencyCents(data.avg_price_cents, currency) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Máximo</p>
                <p className="text-sm font-semibold">
                  {data.max_price_cents !== null ? formatCurrencyCents(data.max_price_cents, currency) : "—"}
                </p>
              </div>
            </div>

            <div className="h-64 w-full" role="img" aria-label={priceHistoryAltText(data, currency)}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) => formatDate(value.slice(0, 10))}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    width={48}
                    tickFormatter={(value: number) => `${Math.round(value / 100) / 10}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrencyCents(Math.round(value * 100), currency)}
                    labelFormatter={(value: string) => formatDate(value.slice(0, 10))}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function priceHistoryAltText(
  data: { min_price_cents: number | null; avg_price_cents: number | null; max_price_cents: number | null; range_days: number },
  currency: string
): string {
  const min = data.min_price_cents !== null ? formatCurrencyCents(data.min_price_cents, currency) : "sem dado";
  const avg = data.avg_price_cents !== null ? formatCurrencyCents(data.avg_price_cents, currency) : "sem dado";
  const max = data.max_price_cents !== null ? formatCurrencyCents(data.max_price_cents, currency) : "sem dado";
  return `Gráfico de linha do preço nos últimos ${data.range_days} dias. Mínimo ${min}, média ${avg}, máximo ${max}.`;
}
