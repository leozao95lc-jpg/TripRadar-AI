import { useQuery } from "@tanstack/react-query";

import { dashboardActivityRepository } from "@/lib/api/dashboard-activity";

export function useDashboardActivity(limit = 5) {
  return useQuery({
    queryKey: ["dashboard-activity", limit],
    queryFn: () => dashboardActivityRepository.listRecent(limit),
    staleTime: 60_000,
  });
}
