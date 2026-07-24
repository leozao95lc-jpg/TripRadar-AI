import { TrendingDown, TrendingUp, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { TripScoreVerdict } from "@/lib/api/types";

const VERDICT_CONFIG: Record<
  TripScoreVerdict,
  { label: string; variant: "success" | "warning" | "neutral"; icon: typeof TrendingDown }
> = {
  buy: { label: "Comprar agora", variant: "success", icon: TrendingDown },
  wait: { label: "Vale esperar", variant: "warning", icon: TrendingUp },
  insufficient_data: { label: "Coletando dados", variant: "neutral", icon: Clock3 },
};

export function TripScoreBadge({ verdict }: { verdict: TripScoreVerdict }) {
  const config = VERDICT_CONFIG[verdict];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
