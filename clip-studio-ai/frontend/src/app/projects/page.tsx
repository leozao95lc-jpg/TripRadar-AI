"use client";
import Link from "next/link";
import { api, fmtDate, Project } from "@/lib/api";
import Shell from "@/components/Shell";
import NewProjectButton from "@/components/NewProject";
import { ErrorNote, useLoad } from "@/components/ui";

export default function Projects() {
  const { data, error } = useLoad(() => api<Project[]>("/projects"));
  return (
    <Shell title="Projetos" subtitle="Cada projeto guarda seus próprios vídeos, transcrições e cortes" action={<NewProjectButton />}>
      <ErrorNote error={error} />
      {data && !data.length && <p className="text-muted">Nenhum projeto criado.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="rounded-xl border border-line bg-surface p-4 transition hover:border-orange">
            <h2 className="truncate text-lg font-semibold">{p.name}</h2>
            <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted">{p.description || "Sem descrição"}</p>
            <p className="mt-3 font-mono text-[11px] uppercase text-muted">
              {p.video_count} vídeo(s) · {p.clip_count} corte(s) · {p.export_count} export(s) · {fmtDate(p.created_at)}
            </p>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
