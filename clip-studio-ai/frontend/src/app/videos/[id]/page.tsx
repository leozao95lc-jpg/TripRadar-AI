"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { API, api, Brand, Clip, fmtDur, fmtSize, fmtTime, Segment, SubtitleSettings, Video } from "@/lib/api";
import Shell from "@/components/Shell";
import ClipEditor from "@/components/ClipEditor";
import { JobRow, useJobs } from "@/components/Jobs";
import { Badge, Button, Card, ErrorNote, Field, Modal, useLoad } from "@/components/ui";

const CLIP_COLOR: Record<string, string> = { suggested: "bg-cream/40", approved: "bg-green-soft", rejected: "bg-danger/50", rendered: "bg-gold" };
const STEPS = ["Importado", "Transcrição", "Análise da IA", "Revisão", "Renderização", "Exportado"];

/** Etapas do pipeline derivadas do que já existe de fato (transcrição, cortes, exportações). */
function Stepper({ done, active, failed }: { done: boolean[]; active: number; failed: boolean }) {
  return (
    <ol className="mb-4 flex flex-wrap items-center gap-y-2 rounded-xl border border-line bg-surface px-4 py-3">
      {STEPS.map((label, i) => {
        const state = done[i] ? "done" : i === active ? (failed ? "failed" : "active") : "todo";
        return (
          <li key={label} className="flex items-center">
            <span className={`grid h-6 w-6 place-items-center rounded-full font-mono text-[11px] font-bold ${state === "done" ? "bg-green-soft text-cream" : state === "active" ? "animate-pulse bg-orange text-bg" : state === "failed" ? "bg-danger text-cream" : "bg-raised text-muted"}`}>
              {state === "done" ? "✓" : state === "failed" ? "!" : i + 1}
            </span>
            <span className={`ml-2 text-sm ${state === "todo" ? "text-muted" : state === "failed" ? "text-danger" : "text-cream"}`}>{label}</span>
            {i < STEPS.length - 1 && <span className={`mx-3 h-px w-6 sm:w-10 ${done[i] ? "bg-green-soft" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

const DEFAULTS = { min_clips: 5, max_clips: 10, preferred_min_seconds: 20, preferred_max_seconds: 60, max_seconds: 90, instructions: "" };

export default function VideoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const video = useLoad(() => api<Video>(`/videos/${id}`), [id]);
  const clips = useLoad(() => api<Clip[]>(`/videos/${id}/clips`), [id]);
  const hasTranscriptFlag = video.data?.has_transcript ?? false;
  const transcript = useLoad(
    () => (hasTranscriptFlag ? api<{ language: string; segments: Segment[] }>(`/videos/${id}/transcript`).catch(() => null) : Promise.resolve(null)),
    [id, hasTranscriptFlag]);
  const subs = useLoad(() => api<SubtitleSettings>("/settings/subtitles"));
  const brand = useLoad(() => api<Brand>("/settings/brand"));
  const reloadAll = useCallback(() => { video.reload(); clips.reload(); transcript.reload(); }, [video, clips, transcript]);
  const { jobs, refresh, active } = useJobs(`video_id=${id}&limit=8`, reloadAll);

  const player = useRef<HTMLVideoElement>(null);
  const stopAt = useRef<number | null>(null);
  const [time, setTime] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"clips" | "transcript">("clips");
  const [modal, setModal] = useState<"process" | "analyze" | "manual" | null>(null);
  const [cfg, setCfg] = useState(DEFAULTS);
  const [language, setLanguage] = useState("");
  const [manual, setManual] = useState({ title: "", start_time: 0, end_time: 30 });
  const [error, setError] = useState<string | null>(null);

  const v = video.data;
  const list = clips.data ?? [];
  const current = list.find((c) => c.id === selected) ?? null;
  useEffect(() => { if (!selected && list.length) setSelected(list[0].id); }, [list, selected]);

  const seek = (t: number) => { if (player.current) { stopAt.current = null; player.current.currentTime = t; } };
  const playRange = (start: number, end: number) => {
    if (!player.current) return;
    player.current.currentTime = start;
    stopAt.current = end;
    player.current.play();
  };
  const onTime = () => {
    const p = player.current;
    if (!p) return;
    setTime(p.currentTime);
    if (stopAt.current !== null && p.currentTime >= stopAt.current) { p.pause(); stopAt.current = null; }
  };
  const run = async (path: string, json: object) => {
    try { await api(path, { method: "POST", json }); setModal(null); setError(null); refresh(); video.reload(); }
    catch (e) { setError((e as Error).message); }
  };
  const busy = active.some((j) => j.job_type !== "render");
  const hasTranscript = !!transcript.data;
  const exported = list.some((c) => c.exports.length > 0);
  const stepsDone = [true, hasTranscript, list.some((c) => c.editorial_score > 0), list.some((c) => c.status === "approved" || c.status === "rendered"), exported, exported];
  const stepActive = ({ transcribing: 1, analyzing: 2, awaiting_review: 3, rendering: 4 } as Record<string, number>)[v?.status ?? ""] ?? (v?.status === "failed" ? stepsDone.indexOf(false) : -1);
  const visibleJobs = jobs.filter((j, i) => j.status === "pending" || j.status === "running" || (i === 0 && j.status === "failed"));

  const analysisForm = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mín. de cortes"><input type="number" min={1} max={20} value={cfg.min_clips} onChange={(e) => setCfg({ ...cfg, min_clips: +e.target.value })} /></Field>
        <Field label="Máx. de cortes"><input type="number" min={1} max={20} value={cfg.max_clips} onChange={(e) => setCfg({ ...cfg, max_clips: +e.target.value })} /></Field>
        <Field label="Duração pref. mín. (s)"><input type="number" min={5} value={cfg.preferred_min_seconds} onChange={(e) => setCfg({ ...cfg, preferred_min_seconds: +e.target.value })} /></Field>
        <Field label="Duração pref. máx. (s)"><input type="number" min={5} value={cfg.preferred_max_seconds} onChange={(e) => setCfg({ ...cfg, preferred_max_seconds: +e.target.value })} /></Field>
      </div>
      <Field label="Duração máxima absoluta (s)"><input type="number" min={10} max={600} value={cfg.max_seconds} onChange={(e) => setCfg({ ...cfg, max_seconds: +e.target.value })} /></Field>
      <Field label="Orientação editorial (opcional)" hint="Ex.: priorizar histórias de perrengue; evitar trechos com patrocínio.">
        <textarea rows={2} maxLength={1000} value={cfg.instructions} onChange={(e) => setCfg({ ...cfg, instructions: e.target.value })} />
      </Field>
      <p className="text-xs text-muted">Somente o texto da transcrição e os timestamps são enviados à API Claude. O vídeo e o áudio permanecem neste servidor.</p>
    </div>
  );

  return (
    <Shell title={v?.filename ?? "Vídeo"}
      subtitle={v && <span className="flex flex-wrap items-center gap-2"><Link className="text-orange hover:underline" href={`/projects/${v.project_id}`}>← Projeto</Link><Badge status={v.status} />{v.hdr && <span title="Vídeo HDR: convertido automaticamente para SDR na visualização e na exportação"><Badge>HDR → SDR</Badge></span>}<span className="font-mono text-xs">{fmtDur(v.duration)} · {v.resolution} · {v.fps} fps · {fmtSize(v.size_bytes)}{transcript.data ? ` · idioma: ${transcript.data.language}` : ""}</span></span>}
      action={<div className="flex flex-wrap gap-2">
        {!hasTranscript && <Button variant="primary" disabled={busy} onClick={() => setModal("process")}>Transcrever e analisar</Button>}
        {hasTranscript && <Button variant="primary" disabled={busy} onClick={() => setModal("analyze")}>{list.length ? "Nova análise" : "Analisar com IA"}</Button>}
        {v && <Button onClick={() => { setManual({ title: "", start_time: Math.floor(time), end_time: Math.min(v?.duration ?? 30, Math.floor(time) + 30) }); setModal("manual"); }}>+ Corte manual</Button>}
        <Button variant="danger" onClick={async () => { if (confirm("Excluir este vídeo, a transcrição e os cortes?")) { try { await api(`/videos/${id}`, { method: "DELETE" }); router.replace(`/projects/${v?.project_id}`); } catch (e) { setError((e as Error).message); } } }}>Excluir</Button>
      </div>}>
      <ErrorNote error={video.error || error} />
      {v && <Stepper done={stepsDone} active={stepActive} failed={v.status === "failed"} />}
      {visibleJobs.length > 0 && <div className="mb-4 space-y-2">{visibleJobs.map((j) => <JobRow key={j.id} job={j} onChange={refresh} />)}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-xl border border-line bg-black">
            <video key={v?.has_preview ? "preview" : "original"} ref={player} src={`${API}/api/videos/${id}/stream${v?.has_preview ? "?preview=1" : ""}`} controls preload="metadata" onTimeUpdate={onTime} className="aspect-video w-full" />
          </div>

          {v && (
            <div>
              <div className="relative h-14 cursor-pointer overflow-hidden rounded-lg border border-line bg-surface"
                onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * v.duration); }}>
                {list.map((c) => (
                  <button key={c.id} title={`${c.title} (${fmtTime(c.start_time)}–${fmtTime(c.end_time)})`}
                    onClick={(e) => { e.stopPropagation(); setSelected(c.id); setTab("clips"); seek(c.start_time); }}
                    className={`absolute top-2 h-10 rounded ${CLIP_COLOR[c.status] ?? "bg-cream/40"} ${c.id === selected ? "ring-2 ring-orange" : "opacity-80 hover:opacity-100"}`}
                    style={{ left: `${(c.start_time / v.duration) * 100}%`, width: `max(4px, ${(c.duration / v.duration) * 100}%)` }} />
                ))}
                <div className="pointer-events-none absolute top-0 h-full w-0.5 bg-orange" style={{ left: `${(time / v.duration) * 100}%` }} />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[11px] text-muted">
                <span>00:00</span>
                <span className="flex gap-3">
                  {Object.entries({ suggested: "sugerido", approved: "aprovado", rendered: "renderizado", rejected: "rejeitado" }).map(([k, l]) => <span key={k} className="flex items-center gap-1"><i className={`inline-block h-2 w-2 rounded-sm ${CLIP_COLOR[k]}`} />{l}</span>)}
                </span>
                <span>{fmtTime(time)} / {fmtTime(v.duration)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-1 border-b border-line">
            {([["clips", `Cortes (${list.length})`], ["transcript", "Transcrição"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm ${tab === k ? "border-b-2 border-orange text-cream" : "text-muted hover:text-cream"}`}>{l}</button>
            ))}
            {hasTranscript && <span className="ml-auto flex items-center gap-3 text-xs">
              <a className="text-orange hover:underline" href={`${API}/api/videos/${id}/transcript?format=srt`}>Baixar SRT</a>
              <a className="text-orange hover:underline" target="_blank" href={`${API}/api/videos/${id}/transcript`}>JSON</a>
            </span>}
          </div>

          {tab === "clips" && (list.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((c) => (
                <button key={c.id} onClick={() => { setSelected(c.id); seek(c.start_time); }}
                  className={`rounded-xl border bg-surface p-3 text-left transition ${c.id === selected ? "border-orange" : "border-line hover:border-muted"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-semibold leading-snug">{c.title}</h3>
                    <span className="font-display text-xl font-bold text-gold" title="Pontuação editorial da IA">{c.editorial_score || "manual"}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{c.hook}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted">{fmtTime(c.start_time)} → {fmtTime(c.end_time)} · {c.duration.toFixed(1)}s</span>
                    <Badge status={c.status} />
                  </div>
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-muted">{hasTranscript ? "Nenhum corte ainda. Rode a análise com IA ou crie um corte manual." : "Transcreva o vídeo para a IA sugerir os melhores momentos, ou crie um corte manual."}</p>)}

          {tab === "transcript" && (transcript.data ? (
            <div className="max-h-[480px] space-y-0.5 overflow-auto rounded-xl border border-line bg-surface p-3">
              {transcript.data.segments.map((s) => (
                <button key={s.id} onClick={() => seek(s.start)} className={`flex w-full gap-3 rounded px-2 py-1 text-left text-sm hover:bg-raised ${time >= s.start && time < s.end ? "bg-raised text-cream" : "text-cream/80"}`}>
                  <span className="shrink-0 font-mono text-[11px] text-muted">{fmtTime(s.start)}</span><span>{s.text}</span>
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-muted">Este vídeo ainda não foi transcrito.</p>)}
        </div>

        <Card title={current ? "Editor do corte" : "Editor de cortes"} className="h-fit xl:sticky xl:top-6">
          {current && v ? (
            <ClipEditor key={current.id} clip={current} duration={v.duration} currentTime={() => player.current?.currentTime ?? 0} onPlay={playRange}
              onChange={() => { clips.reload(); refresh(); video.reload(); }} subs={subs.data} brand={brand.data}
              renderJob={active.find((j) => j.clip_id === current.id)} />
          ) : <p className="text-sm text-muted">Selecione um corte para revisar, ajustar e aprovar. Nada é renderizado sem a sua aprovação.</p>}
        </Card>
      </div>

      {modal === "process" && (
        <Modal title="Transcrever e analisar" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <Field label="Idioma do vídeo">
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="">Detectar automaticamente</option><option value="pt">Português</option><option value="es">Espanhol</option>
              </select>
            </Field>
            {analysisForm}
            <ErrorNote error={error} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => run(`/videos/${id}/transcribe`, { language: language || null })}>Só transcrever</Button>
              <Button variant="primary" onClick={() => run(`/videos/${id}/process`, { language: language || null, analysis: cfg })}>Iniciar processamento</Button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "analyze" && (
        <Modal title="Análise editorial com IA" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {list.length > 0 && <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">Sugestões ainda não revisadas serão substituídas. Cortes aprovados, renderizados ou rejeitados são mantidos, e esses trechos não voltam como sugestão.</p>}
            {analysisForm}
            <ErrorNote error={error} />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setModal(null)}>Cancelar</Button>
              <Button variant="primary" onClick={() => run(`/videos/${id}/analyze`, { analysis: cfg })}>Analisar</Button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "manual" && (
        <Modal title="Corte manual" onClose={() => setModal(null)}>
          <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); try { const c = await api<Clip>(`/videos/${id}/clips`, { method: "POST", json: manual }); setModal(null); setError(null); await clips.reload(); setSelected(c.id); } catch (err) { setError((err as Error).message); } }}>
            <Field label="Título"><input autoFocus value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início (s)"><input type="number" step={0.1} min={0} value={manual.start_time} onChange={(e) => setManual({ ...manual, start_time: +e.target.value })} /></Field>
              <Field label="Fim (s)"><input type="number" step={0.1} min={0} value={manual.end_time} onChange={(e) => setManual({ ...manual, end_time: +e.target.value })} /></Field>
            </div>
            <ErrorNote error={error} />
            <div className="flex justify-end gap-2"><Button type="button" onClick={() => setModal(null)}>Cancelar</Button><Button variant="primary" disabled={!manual.title.trim()}>Criar corte</Button></div>
          </form>
        </Modal>
      )}
    </Shell>
  );
}
