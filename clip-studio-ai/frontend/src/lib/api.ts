export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type Project = { id: string; name: string; description: string; created_at: string; video_count: number; clip_count: number; export_count: number; videos?: Video[] };
export type Video = { id: string; project_id: string; filename: string; size_bytes: number; duration: number; resolution: string; fps: number; has_audio: boolean; status: string; created_at: string };
export type ExportT = { id: string; clip_id: string; format: string; resolution: string; size_bytes: number; created_at: string; clip_title: string; project_id: string; project_name: string };
export type Clip = { id: string; video_id: string; title: string; hook: string; start_time: number; end_time: number; duration: number; transcript: string; rationale: string; cta: string; editorial_score: number; category: string; warnings: string[]; status: string; render_options: Record<string, unknown>; exports: ExportT[] };
export type Job = { id: string; project_id: string; video_id: string | null; clip_id: string | null; job_type: string; status: string; progress: number; stage: string; attempts: number; error_message: string | null; created_at: string; updated_at: string; log?: string };
export type Segment = { id: number; start: number; end: number; text: string };
export type SubtitleStyle = { font: string; size: number; bold: boolean; uppercase: boolean; color: string; highlight_words: boolean; highlight_color: string; outline_color: string; outline_width: number; background: "none" | "box"; background_color: string; background_opacity: number; position: "auto" | "top" | "middle" | "bottom"; margin_v: number; max_words: number; animation: "none" | "fade" | "pop" };
export type SubtitleSettings = { builtin: Record<string, SubtitleStyle>; custom: Record<string, SubtitleStyle>; fonts: string[]; render_presets: Record<string, { label: string; max_seconds: number }> };
export type Brand = { channel_name: string; channel_description: string; primary_color: string; accent_color: string; default_subtitle_preset: string; has_logo: boolean };
export type Dashboard = { totals: { projects: number; videos: number; clips: number; exports: number; active_jobs: number }; recent_projects: Project[]; active_jobs: Job[]; recent_exports: ExportT[]; disk_free_gb: number };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function detail(body: unknown, status: number): string {
  const d = (body as { detail?: unknown })?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`).join("; ");
  return `Erro ${status}`;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API}/api${path}`, {
      credentials: "include", ...rest,
      headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor. Verifique se o backend está em execução.");
  }
  if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
    location.href = "/login";
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, detail(body, res.status));
  return body as T;
}

/** Upload por streaming: o navegador lê o arquivo do disco em blocos (o File nunca é carregado em memória). */
export function uploadVideo(projectId: string, file: File, onProgress: (fraction: number) => void) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<Video>((resolve, reject) => {
    xhr.open("POST", `${API}/api/projects/${projectId}/videos?filename=${encodeURIComponent(file.name)}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: unknown = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* resposta sem JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as Video);
      else reject(new ApiError(xhr.status, detail(body, xhr.status)));
    };
    xhr.onerror = () => reject(new ApiError(0, "Falha de conexão durante o upload."));
    xhr.onabort = () => reject(new ApiError(0, "Upload cancelado."));
    xhr.send(file);
  });
  return { promise, abort: () => xhr.abort() };
}

export const fmtTime = (t: number) => {
  const s = Math.max(0, t), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const ss = sec.toFixed(1).padStart(4, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${String(m).padStart(2, "0")}:${ss}`;
};
export const fmtDur = (t: number) => (t >= 3600 ? `${Math.floor(t / 3600)}h ${Math.round((t % 3600) / 60)}min` : t >= 60 ? `${Math.floor(t / 60)}min ${Math.round(t % 60)}s` : `${t.toFixed(1)}s`);
export const fmtSize = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`);
export const fmtDate = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export const STATUS: Record<string, { label: string; tone: "muted" | "orange" | "gold" | "green" | "danger" }> = {
  pending: { label: "Pendente", tone: "muted" }, uploading: { label: "Enviando", tone: "orange" },
  transcribing: { label: "Transcrevendo", tone: "orange" }, transcribed: { label: "Transcrito", tone: "gold" },
  analyzing: { label: "Analisando", tone: "orange" }, awaiting_review: { label: "Aguardando revisão", tone: "gold" },
  rendering: { label: "Renderizando", tone: "orange" }, completed: { label: "Concluído", tone: "green" },
  failed: { label: "Falhou", tone: "danger" }, running: { label: "Em execução", tone: "orange" },
  cancelled: { label: "Cancelado", tone: "muted" }, suggested: { label: "Sugerido", tone: "muted" },
  approved: { label: "Aprovado", tone: "green" }, rejected: { label: "Rejeitado", tone: "danger" },
  rendered: { label: "Renderizado", tone: "gold" },
};
export const JOB_LABEL: Record<string, string> = { process: "Transcrição + análise", transcribe: "Transcrição", analyze: "Análise editorial", render: "Renderização" };
export const CATEGORY: Record<string, string> = { historia: "História", humor: "Humor", emocao: "Emoção", opiniao: "Opinião", dica: "Dica", informacao: "Informação", bastidores: "Bastidores", reflexao: "Reflexão", outro: "Outro" };
