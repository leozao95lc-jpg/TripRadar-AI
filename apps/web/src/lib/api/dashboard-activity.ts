// Não existe, hoje, um endpoint de "disparos recentes de alerta por usuário" no
// backend (o módulo `alerts` guarda AlertTrigger, mas só expõe listagem por alerta
// individual, não um feed agregado — ver docs/09-revisao-tecnica-backend.md). Em vez
// de inventar dado ou deixar a seção "Atividade recente" do Dashboard vazia por
// completo, isolamos essa fonte atrás da interface abaixo: os componentes importam
// só `dashboardActivityRepository`, nunca o mock diretamente. Quando o backend
// ganhar `GET /api/v1/alerts/triggers/recent` (ou equivalente), troca-se a
// implementação exportada aqui por uma que chama `apiRequest` — nenhum componente
// muda.

import { mockDashboardActivityRepository } from "@/lib/api/mocks/dashboard-activity.mock";

export interface RecentActivityItem {
  id: string;
  originIata: string;
  destinationIata: string;
  priceCents: number;
  currency: string;
  triggeredAt: string;
}

export interface DashboardActivityRepository {
  listRecent(limit: number): Promise<RecentActivityItem[]>;
}

export const dashboardActivityRepository: DashboardActivityRepository = mockDashboardActivityRepository;
