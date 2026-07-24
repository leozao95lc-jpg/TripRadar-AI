// Mock isolado — ver comentário em lib/api/dashboard-activity.ts sobre por que ele
// existe e como substituí-lo. NUNCA importar este arquivo diretamente de um
// componente; sempre passar por `dashboardActivityRepository`.

import type { DashboardActivityRepository, RecentActivityItem } from "@/lib/api/dashboard-activity";

const FIXTURE: RecentActivityItem[] = [
  {
    id: "mock-1",
    originIata: "GRU",
    destinationIata: "LIS",
    priceCents: 289_000,
    currency: "BRL",
    triggeredAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: "mock-2",
    originIata: "FLN",
    destinationIata: "MAD",
    priceCents: 342_000,
    currency: "BRL",
    triggeredAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
  {
    id: "mock-3",
    originIata: "GIG",
    destinationIata: "MCO",
    priceCents: 261_500,
    currency: "BRL",
    triggeredAt: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
  },
];

export const mockDashboardActivityRepository: DashboardActivityRepository = {
  async listRecent(limit: number): Promise<RecentActivityItem[]> {
    return FIXTURE.slice(0, limit);
  },
};
