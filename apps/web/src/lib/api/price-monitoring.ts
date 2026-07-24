import { apiRequest } from "@/lib/api/client";
import type { CabinClass, PriceHistory } from "@/lib/api/types";

export async function getRouteHistory(
  originIata: string,
  destinationIata: string,
  cabinClass: CabinClass,
  rangeDays = 90
) {
  return apiRequest<PriceHistory>(`/api/v1/routes/${originIata}/${destinationIata}/history`, {
    params: { cabin_class: cabinClass, range_days: rangeDays },
    auth: false,
  });
}
