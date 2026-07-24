import { getAccessToken } from "@/lib/auth/token-storage";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

// Registrado pelo AuthProvider no mount — mantém client.ts sem depender do módulo de
// auth (evita import circular) enquanto ainda reage a um 401 em qualquer chamada.
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  auth?: boolean;
  params?: Record<string, string | number | undefined>;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, params } = options;

  const url = new URL(path, API_BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor. Verifique sua conexão.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    if (response.status === 401 && auth) {
      unauthorizedHandler?.();
    }
    const message =
      (payload && typeof payload === "object" && "detail" in payload && String(payload.detail)) ||
      response.statusText ||
      "Erro inesperado";
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}
