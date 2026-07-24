import { apiRequest } from "@/lib/api/client";
import type { CreateAlertInput, SearchAlert } from "@/lib/api/types";

// Não existe GET /api/v1/alerts/{id} no backend hoje — só list/create/delete (ver
// apps/api/src/modules/alerts/interface/routes.py). A tela de detalhe do alerta
// deriva o registro a partir da listagem já buscada (ver hooks/use-alerts.ts),
// em vez de mockar um endpoint que não existe — a lista real já tem o dado inteiro.

export async function listAlerts() {
  return apiRequest<SearchAlert[]>("/api/v1/alerts");
}

export async function createAlert(input: CreateAlertInput) {
  return apiRequest<SearchAlert>("/api/v1/alerts", { method: "POST", body: input });
}

export async function deleteAlert(alertId: string) {
  return apiRequest<void>(`/api/v1/alerts/${alertId}`, { method: "DELETE" });
}
