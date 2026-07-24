"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCurrencyCents, formatDate } from "@/lib/utils";
import type { PriceSnapshot } from "@/lib/api/types";

export function PublicPriceChart({ snapshots, currency }: { snapshots: PriceSnapshot[]; currency: string }) {
  const chartData = snapshots.map((snapshot) => ({
    date: snapshot.collected_at,
    price: snapshot.price_cents / 100,
  }));

  return (
    <div className="h-64 w-full">
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
          <Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
