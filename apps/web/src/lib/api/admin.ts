import { apiRequest } from "@/lib/api/client";
import type { AdminDashboard, FeatureFlag, SetFeatureFlagInput } from "@/lib/api/types";

export async function getAdminDashboard() {
  return apiRequest<AdminDashboard>("/api/v1/admin/dashboard");
}

export async function listFeatureFlags() {
  return apiRequest<FeatureFlag[]>("/api/v1/admin/feature-flags");
}

export async function setFeatureFlag(key: string, input: SetFeatureFlagInput) {
  return apiRequest<FeatureFlag>(`/api/v1/admin/feature-flags/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: input,
  });
}
