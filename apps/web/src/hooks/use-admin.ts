import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as adminApi from "@/lib/api/admin";
import type { SetFeatureFlagInput } from "@/lib/api/types";

export const adminDashboardQueryKey = ["admin", "dashboard"] as const;

export function useAdminDashboard(enabled = true) {
  // O dashboard mistura contadores que mudam pouco (users_total) com heartbeat de
  // worker, que o operador quer ver fresco sem precisar recarregar a página à mão.
  // `enabled` deixa a página não disparar a requisição (que o backend rejeitaria
  // com 403) enquanto ainda não sabe se o usuário é admin — sem isso, todo usuário
  // comum que abrisse /admin geraria uma chamada fadada a falhar antes do redirect.
  return useQuery({
    queryKey: adminDashboardQueryKey,
    queryFn: adminApi.getAdminDashboard,
    refetchInterval: 30_000,
    enabled,
  });
}

export function useSetFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, input }: { key: string; input: SetFeatureFlagInput }) =>
      adminApi.setFeatureFlag(key, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDashboardQueryKey });
    },
  });
}
