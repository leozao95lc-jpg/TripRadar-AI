import { useQuery } from "@tanstack/react-query";

import { getAlertRecommendation } from "@/lib/api/recommendations";

export function useRecommendation(alertId: string | undefined) {
  return useQuery({
    queryKey: ["recommendation", alertId],
    queryFn: () => getAlertRecommendation(alertId as string),
    enabled: Boolean(alertId),
    staleTime: 60_000,
  });
}
