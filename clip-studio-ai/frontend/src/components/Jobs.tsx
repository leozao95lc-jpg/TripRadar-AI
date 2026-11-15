"use client";
import { useEffect, useRef, useState } from "react";
import { api, Job, JOB_LABEL } from "@/lib/api";
import { Badge, Button, Progress } from "./ui";

/** Acompanha os jobs de um vídeo (ou todos) por polling enquanto houver algo em andamento. */
export function useJobs(query: string, onSettled?: () => void) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const wasActive = useRef(false);
  const cb = useRef(onSettled);
  cb.current = onSettled;
  const refresh = () => api<Job[]>(`/jobs?${query}`).then(setJobs).catch(() => {});
  useEffect(() => {
    let stop = false, timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const list = await api<Job[]>(`/jobs?${query}`).catch(() => null);
      if (stop) return;
      if (list) {
        setJobs(list);
        const active = list.some((j) => j.status === "pending" || j.status === "running");
        if (wasActive.current && !active) cb.current?.();
        wasActive.current = active;
        timer = setTimeout(tick, active ? 1500 : 6000);
      } else timer = setTimeout(tick, 6000);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [query]);
  return { jobs, refresh, active: jobs.filter((j) => j.status === "pending" || j.status === "running") };
}

export function JobRow({ job, onChange }: { job: Job; onChange?: () => void }) {
  const [log, setLog] = useState<string | null>(null);
  const running = job.status === "pending" || job.status === "running";
  return (
    <div className="rounded-lg border border-line bg-bg p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{JOB_LABEL[job.job_type] ?? job.job_type}</p>
          <p className="font-mono text-[11px] text-muted">{job.stage || "Na fila"}{running ? ` · ${Math.round(job.progress * 100)}%` : ""}{job.attempts > 1 ? ` · tentativa ${job.attempts}` : ""}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge status={job.status} />
          {running && <Button small variant="danger" onClick={() => api(`/jobs/${job.id}/cancel`, { method: "POST" }).then(onChange)}>Cancelar</Button>}
          {!running && <Button small onClick={() => (log === null ? api<Job>(`/jobs/${job.id}`).then((j) => setLog(j.log || "(sem log)")) : setLog(null))}>{log === null ? "Log" : "Fechar"}</Button>}
        </div>
      </div>
      {running && <div className="mt-2"><Progress value={job.progress} /></div>}
      {job.error_message && <p className="mt-2 text-sm text-danger">{job.error_message}</p>}
      {log !== null && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-surface p-2 font-mono text-[11px] text-muted">{log}</pre>}
    </div>
  );
}
