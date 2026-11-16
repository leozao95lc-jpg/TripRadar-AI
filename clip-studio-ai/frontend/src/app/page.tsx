"use client";
import Link from "next/link";
import { API, api, Dashboard, fmtDate, fmtSize } from "@/lib/api";
import Shell from "@/components/Shell";
import NewProjectButton from "@/components/NewProject";
import { JobRow, useJobs } from "@/components/Jobs";
import { Card, ErrorNote, Stat, useLoad } from "@/components/ui";

export default function DashboardPage() {
  const { data, error, reload } = useLoad(() => api<Dashboard>("/dashboard"));
  const { active, refresh } = useJobs("active=true", reload);
  const t = data?.totals;
  return (
    <Shell title="Dashboard" subtitle="Visão geral da produção de cortes" action={<NewProjectButton />}>
      <ErrorNote error={error} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Projetos" value={t?.projects ?? "–"} />
        <Stat label="Vídeos importados" value={t?.videos ?? "–"} />
        <Stat label="Cortes gerados" value={t?.clips ?? "–"} />
        <Stat label="Em processamento" value={active.length} accent={active.length > 0} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Últimos projetos" action={<Link href="/projects" className="text-sm text-orange hover:underline">Ver todos</Link>}>
          {data?.recent_projects.length ? (
            <ul className="divide-y divide-line">
              {data.recent_projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-orange">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">{p.video_count} vídeo(s) · {p.clip_count} corte(s)</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Nenhum projeto ainda. Crie o primeiro para importar um vídeo.</p>}
        </Card>
        <Card title="Processamentos em andamento">
          {active.length ? <div className="space-y-2">{active.map((j) => <JobRow key={j.id} job={j} onChange={refresh} />)}</div>
            : <p className="text-sm text-muted">Nada em processamento no momento.</p>}
        </Card>
        <Card title="Histórico de exportações" className="xl:col-span-2" action={data && <span className="font-mono text-xs text-muted">{t?.exports} no total · {data.disk_free_gb} GB livres</span>}>
          {data?.recent_exports.length ? (
            <table className="w-full text-sm">
              <thead className="text-left font-mono text-[11px] uppercase text-muted">
                <tr><th className="pb-2">Corte</th><th>Projeto</th><th>Formato</th><th>Tamanho</th><th>Data</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.recent_exports.map((e) => (
                  <tr key={e.id}>
                    <td className="max-w-[240px] truncate py-2 pr-3">{e.clip_title}</td>
                    <td className="pr-3"><Link className="hover:text-orange" href={`/projects/${e.project_id}`}>{e.project_name}</Link></td>
                    <td className="font-mono text-xs uppercase">{e.format} · {e.resolution}</td>
                    <td className="font-mono text-xs">{fmtSize(e.size_bytes)}</td>
                    <td className="font-mono text-xs">{fmtDate(e.created_at)}</td>
                    <td className="text-right"><a className="text-orange hover:underline" href={`${API}/api/exports/${e.id}/download`}>Baixar</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-muted">Os vídeos exportados aparecem aqui.</p>}
        </Card>
      </div>
    </Shell>
  );
}
