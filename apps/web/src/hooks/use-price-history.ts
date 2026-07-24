import { useQuery } from "@tanstack/react-query";

import { getRouteHistory } from "@/lib/api/price-monitoring";
import type { CabinClass } from "@/lib/api/types";

export function usePriceHistory(
  originIata: string | undefined,
  destinationIata: string | undefined,
  cabinClass: CabinClass | undefined,
  rangeDays = 90
) {
  return useQuery({
    queryKey: ["price-history", originIata, destinationIata, cabinClass, rangeDays],
    queryFn: () => getRouteHistory(originIata as string, destinationIata as string, cabinClass as CabinClass, rangeDays),
    enabled: Boolean(originIata && destinationIata && cabinClass),
    staleTime: 60_000,
  });
}
