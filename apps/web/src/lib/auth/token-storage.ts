// Guarda os tokens em localStorage — funciona sem infraestrutura extra, mas é
// acessível a qualquer script que rode na página (risco de XSS roubar o token). O
// endurecimento recomendado antes de escalar é um proxy BFF em Next.js que troque
// isso por um cookie httpOnly (a API FastAPI fica em outra origem, então não dá pra
// setar o cookie direto sem esse proxy). Ver docs/09-revisao-tecnica-backend.md para
// o mesmo tipo de trade-off já documentado no backend.

const ACCESS_TOKEN_KEY = "tripradar.access_token";
const REFRESH_TOKEN_KEY = "tripradar.refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}
