import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as alertsApi from "@/lib/api/alerts";
import type { CreateAlertInput } from "@/lib/api/types";

export const alertsQueryKey = ["alerts"] as const;

export function useAlerts() {
  return useQuery({ queryKey: alertsQueryKey, queryFn: alertsApi.listAlerts });
}

// Não há GET /alerts/{id} no backend — deriva da lista já carregada (ver comentário
// em lib/api/alerts.ts). `enabled` evita rodar antes da lista existir.
export function useAlert(alertId: string) {
  const { data: alerts, ...rest } = useAlerts();
  const alert = alerts?.find((a) => a.id === alertId) ?? null;
  return { ...rest, data: alert };
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAlertInput) => alertsApi.createAlert(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertsQueryKey });
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => alertsApi.deleteAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertsQueryKey });
    },
  });
}
