"use client";
import { useEffect, useRef, useState } from "react";
import { API, api, Brand, CATEGORY, Clip, ExportT, fmtDate, fmtSize, fmtTime, Job, SubtitleSettings } from "@/lib/api";
import { Badge, Button, ErrorNote, Field } from "./ui";

type Props = {
  clip: Clip; duration: number; currentTime: () => number; onPlay: (start: number, end: number) => void;
  onChange: () => void; subs: SubtitleSettings | null; brand: Brand | null; renderJob?: Job;
};

export default function ClipEditor({ clip, duration, currentTime, onPlay, onChange, subs, brand, renderJob }: Props) {
  const [d, setD] = useState({ title: clip.title, hook: clip.hook, cta: clip.cta, start: clip.start_time, end: clip.end_time });
  const [error, setError] = useState<string | null>(null);
  const [opts, setOpts] = useState({
    preset: "reels", framing: "fit", focus_x: 0.5, fps: "", normalize_audio: true, fade: false, logo: false,
    subtitles: true, subtitle_preset: brand?.default_subtitle_preset ?? "de_mala_y_cuia", ...(clip.render_options as object),
  });
  useEffect(() => {
    setD({ title: clip.title, hook: clip.hook, cta: clip.cta, start: clip.start_time, end: clip.end_time });
    setError(null);
  }, [clip.id, clip.title, clip.hook, clip.cta, clip.start_time, clip.end_time]);

  // feedback após exportar: aparece quando uma nova exportação deste corte fica pronta
  const exports = [...clip.exports].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const known = useRef(clip.exports.length);
  const [fresh, setFresh] = useState<ExportT | null>(null);
  useEffect(() => {
    if (clip.exports.length > known.current) setFresh(exports[0]);
    known.current = clip.exports.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.exports.length]);

  const dirty = d.title !== clip.title || d.hook !== clip.hook || d.cta !== clip.cta || d.start !== clip.start_time || d.end !== clip.end_time;
  const len = d.end - d.start;
  const patch = async (json: object) => {
    try { await api(`/clips/${clip.id}`, { method: "PATCH", json }); setError(null); onChange(); }
    catch (e) { setError((e as Error).message); }
  };
  const save = () => patch({ title: d.title, hook: d.hook, cta: d.cta, start_time: d.start, end_time: d.end });
  const render = async () => {
    try {
      await api(`/clips/${clip.id}/render`, { method: "POST", json: { ...opts, fps: opts.fps ? Number(opts.fps) : null } });
      setError(null); onChange();
    } catch (e) { setError((e as Error).message); }
  };
  const nudge = (k: "start" | "end", v: number) => setD((x) => ({ ...x, [k]: Math.round(Math.min(duration, Math.max(0, x[k] + v)) * 10) / 10 }));
  const canRender = (clip.status === "approved" || clip.status === "rendered") && !dirty && !renderJob;
  const presets = subs ? [...Object.keys(subs.builtin), ...Object.keys(subs.custom)] : [];
  const set = (k: string, v: unknown) => setOpts((o) => ({ ...o, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge status={clip.status} />
        <Badge>{CATEGORY[clip.category] ?? clip.category}</Badge>
        <span className="ml-auto text-right">
          <span className="font-display text-3xl font-bold text-gold">{clip.editorial_score || "—"}</span>
          {clip.editorial_score > 0 && <span className="font-mono text-xs text-muted">/100</span>}
        </span>
      </div>
      <p className="-mt-2 text-right font-mono text-[10px] uppercase text-muted">
        {clip.editorial_score > 0 ? "Pontuação editorial da IA — não é previsão de visualizações" : "Corte manual — sem pontuação da IA"}
      </p>

      {clip.warnings.map((w) => <p key={w} className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">{w}</p>)}

      <Field label="Título"><input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></Field>
      <Field label="Gancho"><textarea rows={2} value={d.hook} onChange={(e) => setD({ ...d, hook: e.target.value })} /></Field>
      <Field label="CTA sugerido"><input value={d.cta} onChange={(e) => setD({ ...d, cta: e.target.value })} /></Field>

      <div className="grid grid-cols-2 gap-3">
        {(["start", "end"] as const).map((k) => (
          <Field key={k} label={k === "start" ? "Início (s)" : "Fim (s)"} hint={fmtTime(d[k])}>
            <input type="number" step={0.1} min={0} max={duration} value={d[k]} onChange={(e) => setD({ ...d, [k]: Number(e.target.value) })} />
            <span className="mt-1 flex gap-1">
              <Button small type="button" onClick={() => nudge(k, -0.5)}>−0,5</Button>
              <Button small type="button" onClick={() => nudge(k, 0.5)}>+0,5</Button>
              <Button small type="button" title="Usar a posição atual do player" onClick={() => setD({ ...d, [k]: Math.round(currentTime() * 10) / 10 })}>◉ player</Button>
            </span>
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`font-mono text-xs ${len < 1 ? "text-danger" : "text-muted"}`}>Duração: {len.toFixed(1)}s · vídeo: {fmtTime(duration)}</span>
        <Button small className="ml-auto" onClick={() => onPlay(d.start, d.end)}>▶ Reproduzir trecho</Button>
        <Button small variant="primary" disabled={!dirty || len < 1 || !d.title.trim()} onClick={save}>Salvar ajustes</Button>
      </div>

      <div className="flex gap-2">
        <Button variant="green" className="flex-1" disabled={clip.status === "approved" || clip.status === "rendered"} onClick={() => patch({ status: "approved" })}>✓ Aprovar</Button>
        <Button variant="danger" className="flex-1" disabled={clip.status === "rejected"} onClick={() => patch({ status: "rejected" })}>✕ Rejeitar</Button>
      </div>
      <ErrorNote error={error} />
      {fresh && (
        <div role="status" className="rounded-lg border border-green-soft bg-green px-3 py-2.5 text-sm">
          <p className="font-semibold">✓ Exportação concluída</p>
          <p className="mt-0.5 text-cream/80">Vídeo vertical pronto ({fresh.resolution}, {fmtSize(fresh.size_bytes)}).</p>
          <p className="mt-2 flex flex-wrap items-center gap-3">
            <a className="rounded-md bg-orange px-3 py-1 font-semibold text-bg" href={`${API}/api/exports/${fresh.id}/download`}>Baixar vídeo</a>
            <a className="underline" target="_blank" href={`${API}/api/exports/${fresh.id}/download?inline=true`}>Assistir</a>
            <button className="ml-auto text-xs text-cream/70 hover:text-cream" onClick={() => setFresh(null)}>Fechar</button>
          </p>
        </div>
      )}

      <details className="rounded-lg border border-line bg-bg p-3" open>
        <summary className="cursor-pointer font-mono text-[11px] uppercase text-muted">{clip.editorial_score > 0 ? "Por que a IA escolheu este trecho" : "Origem do corte"}</summary>
        <p className="mt-2 text-sm">{clip.rationale || "—"}</p>
      </details>
      <details className="rounded-lg border border-line bg-bg p-3">
        <summary className="cursor-pointer font-mono text-[11px] uppercase text-muted">Transcrição do corte</summary>
        <p className="mt-2 text-sm leading-relaxed text-cream/90">{clip.transcript || "—"}</p>
      </details>

      <div className="space-y-3 rounded-lg border border-line bg-bg p-3">
        <p className="font-mono text-[11px] uppercase text-muted">Renderização</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Destino">
            <select value={opts.preset} onChange={(e) => set("preset", e.target.value)}>
              {Object.entries(subs?.render_presets ?? { reels: { label: "Instagram Reels" } }).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="FPS">
            <select value={opts.fps} onChange={(e) => set("fps", e.target.value)}>
              <option value="">Preservar origem</option><option value="24">24</option><option value="30">30</option><option value="60">60</option>
            </select>
          </Field>
          <Field label="Enquadramento">
            <select value={opts.framing} onChange={(e) => set("framing", e.target.value)}>
              <option value="fit">Quadro completo (todos visíveis)</option>
              <option value="crop">Recorte manual 9:16</option>
            </select>
          </Field>
          <Field label="Legenda">
            <select value={opts.subtitles ? opts.subtitle_preset : ""} onChange={(e) => setOpts({ ...opts, subtitles: !!e.target.value, subtitle_preset: e.target.value || opts.subtitle_preset })}>
              <option value="">Sem legenda</option>
              {presets.map((p) => <option key={p} value={p}>{p.replaceAll("_", " ")}</option>)}
            </select>
          </Field>
        </div>
        {opts.framing === "crop" && (
          <Field label={`Foco horizontal do recorte: ${Math.round(opts.focus_x * 100)}%`} hint="O recorte pode deixar pessoas de fora. Confira no resultado se todos os participantes relevantes aparecem.">
            <input type="range" min={0} max={1} step={0.01} value={opts.focus_x} onChange={(e) => set("focus_x", Number(e.target.value))} />
          </Field>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={opts.normalize_audio} onChange={(e) => set("normalize_audio", e.target.checked)} /> Normalizar áudio</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={opts.fade} onChange={(e) => set("fade", e.target.checked)} /> Fade</label>
          <label className={`flex items-center gap-1.5 ${brand?.has_logo ? "" : "opacity-40"}`} title={brand?.has_logo ? "" : "Envie o logo em Canal e legendas"}>
            <input type="checkbox" disabled={!brand?.has_logo} checked={opts.logo} onChange={(e) => set("logo", e.target.checked)} /> Logo
          </label>
        </div>
        <Button variant="primary" className="w-full" disabled={!canRender} onClick={render}>
          {renderJob ? `Renderizando… ${Math.round(renderJob.progress * 100)}%` : clip.exports.length ? "Gerar novamente" : "Renderizar vídeo vertical"}
        </Button>
        {!canRender && !renderJob && <p className="text-xs text-muted">{dirty ? "Salve os ajustes antes de renderizar." : "Aprove o corte para liberar a renderização."}</p>}
        {exports.length > 0 && (
          <ul className="divide-y divide-line border-t border-line pt-1">
            {exports.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="font-mono text-xs uppercase text-muted">{e.format} · {e.resolution} · {fmtSize(e.size_bytes)} · {fmtDate(e.created_at)}</span>
                <span className="flex shrink-0 gap-3">
                  <a className="text-cream hover:underline" target="_blank" href={`${API}/api/exports/${e.id}/download?inline=true`}>Assistir</a>
                  <a className="text-orange hover:underline" href={`${API}/api/exports/${e.id}/download`}>Baixar</a>
                </span>
              </li>
            ))}
          </ul>
        )}
        {clip.transcript && <a className="block text-xs text-muted hover:text-cream hover:underline" href={`${API}/api/clips/${clip.id}/srt`}>Baixar legenda do corte (.srt) para subir como caption</a>}
      </div>
      <Button small variant="danger" onClick={() => confirm("Excluir este corte e suas exportações?") && api(`/clips/${clip.id}`, { method: "DELETE" }).then(onChange).catch((e) => setError(e.message))}>Excluir corte</Button>
    </div>
  );
}
