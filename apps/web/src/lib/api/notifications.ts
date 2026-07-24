import { apiRequest } from "@/lib/api/client";
import type { NotificationChannel, NotificationPreference } from "@/lib/api/types";

export async function listNotificationPreferences() {
  return apiRequest<NotificationPreference[]>("/api/v1/notifications/preferences");
}

export async function setNotificationPreference(input: {
  channel: NotificationChannel;
  destination: string;
  enabled: boolean;
}) {
  return apiRequest<NotificationPreference>("/api/v1/notifications/preferences", {
    method: "PUT",
    body: input,
  });
}

export async function verifyNotificationChannel(input: { channel: NotificationChannel; code: string }) {
  return apiRequest<NotificationPreference>("/api/v1/notifications/preferences/verify", {
    method: "POST",
    body: input,
  });
}
