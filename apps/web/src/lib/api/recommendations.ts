import { apiRequest, ApiError } from "@/lib/api/client";
import type { TripScore } from "@/lib/api/types";

export async function getAlertRecommendation(alertId: string): Promise<TripScore | null> {
  try {
    return await apiRequest<TripScore>(`/api/v1/alerts/${alertId}/recommendation`);
  } catch (error) {
    // 404 = ainda não há snapshot de preço para essa rota (alerta muito novo) —
    // estado esperado, não um erro a propagar pra UI como falha.
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
