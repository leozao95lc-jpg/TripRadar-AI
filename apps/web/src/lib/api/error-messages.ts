import { ApiError } from "@/lib/api/client";

export function friendlyAuthError(error: unknown, context: "login" | "register"): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return "Não foi possível conectar ao servidor. Verifique sua conexão.";
    if (error.status === 429) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    if (context === "login" && error.status === 401) return "E-mail ou senha incorretos.";
    if (context === "register" && error.status === 409) return "Este e-mail já está cadastrado.";
    if (context === "register" && error.status === 403) {
      return "Código de acesso inválido. Este é um beta fechado — peça o código a quem te convidou.";
    }
    if (error.status === 422) return "Confira os dados informados.";
  }
  return "Algo deu errado. Tente novamente em instantes.";
}
