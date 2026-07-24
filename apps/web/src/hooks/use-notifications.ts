import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as notificationsApi from "@/lib/api/notifications";
import type { NotificationChannel } from "@/lib/api/types";

export const notificationPreferencesKey = ["notification-preferences"] as const;

export function useNotificationPreferences() {
  return useQuery({ queryKey: notificationPreferencesKey, queryFn: notificationsApi.listNotificationPreferences });
}

export function useSetNotificationPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { channel: NotificationChannel; destination: string; enabled: boolean }) =>
      notificationsApi.setNotificationPreference(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationPreferencesKey });
    },
  });
}

export function useVerifyNotificationChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { channel: NotificationChannel; code: string }) =>
      notificationsApi.verifyNotificationChannel(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationPreferencesKey });
    },
  });
}
