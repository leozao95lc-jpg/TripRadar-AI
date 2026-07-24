import { apiRequest } from "@/lib/api/client";
import type { AuthTokens, UserProfile } from "@/lib/api/types";

export async function register(input: { email: string; password: string; full_name: string }) {
  return apiRequest<UserProfile>("/api/v1/auth/register", { method: "POST", body: input, auth: false });
}

export async function login(input: { email: string; password: string }) {
  return apiRequest<AuthTokens>("/api/v1/auth/login", { method: "POST", body: input, auth: false });
}

export async function getMe() {
  return apiRequest<UserProfile>("/api/v1/me");
}
