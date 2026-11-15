"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, fmtDate, fmtDur, fmtSize, Project, uploadVideo } from "@/lib/api";
import Shell from "@/components/Shell";
import { JobRow, useJobs } from "@/components/Jobs";
import { Badge, Button, Card, ErrorNote, Field, Modal, Progress, useLoad } from "@/components/ui";

const ACCEPT = [".mp4", ".mov", ".m4v"];

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: project, error, reload } = useLoad(() => api<Project>(`/projects/${id}`), [id]);
  const { jobs, refresh } = useJobs(`project_id=${id}&limit=15`, reload);
  const input = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<{ name: string; progress: number; abort: () => void } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [edit, setEdit] = useState<{ name: string; description: string } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api(`/projects/${id}`, { method: "PATCH", json: edit }); setEdit(null); setEditError(null); reload(); }
    catch (err) { setEditError((err as Error).message); }
  };

  const send = async (file: File) => {
    setUploadError(null);
    if (!ACCEPT.some((ext) => file.name.toLowerCase().endsWith(ext))) return setUploadError("Formato não aceito. Envie MP4, MOV ou M4V.");
    const up = uploadVideo(id, file, (progress) => setUpload((u) => u && { ...u, progress }));
    setUpload({ name: file.name, progress: 0, abort: up.abort });
    try {
      const v = await up.promise;
      router.push(`/videos/${v.id}`);
    } catch (e) {
      setUploadError((e as Error).message);
      setUpload(null);
    }
  };
  const remove = async () => {
    if (!confirm(`Excluir o projeto "${project?.name}" e todos os seus vídeos, transcrições e cortes? Esta ação não pode ser desfeita.`)) return;
    await api(`/projects/${id}`, { method: "DELETE" });
    router.replace("/projects");
  };

  return (
    <Shell title={project?.name ?? "Projeto"} subtitle={project?.description || (project && `Criado em ${fmtDate(project.created_at)}`)}
      action={<div className="flex gap-2">
        <Button disabled={!project} onClick={() => project && setEdit({ name: project.name, description: project.description })}>Editar</Button>
        <Button variant="danger" onClick={remove}>Excluir projeto</Button>
      </div>}>
      {edit && (
        <Modal title="Editar projeto" onClose={() => setEdit(null)}>
          <form onSubmit={saveEdit} className="space-y-4">
            <Field label="Nome"><input autoFocus value={edit.name} maxLength={200} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Descrição"><textarea rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <ErrorNote error={editError} />
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setEdit(null)}>Cancelar</Button>
              <Button variant="primary" disabled={!edit.name.trim()}>Salvar</Button>
            </div>
          </form>
        </Modal>
      )}
      <ErrorNote error={error} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f && !upload) send(f); }}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition ${drag ? "border-orange bg-orange/5" : "border-line bg-surface"}`}>
            {upload ? (
              <div className="mx-auto max-w-md space-y-3">
                <p className="truncate text-sm">Enviando <b>{upload.name}</b></p>
                <Progress value={upload.progress} />
                <div className="flex items-center justify-between font-mono text-xs text-muted">
                  <span>{Math.round(upload.progress * 100)}%{upload.progress >= 1 ? " · validando arquivo…" : ""}</span>
                  <Button small variant="danger" onClick={upload.abort}>Cancelar upload</Button>
                </div>
              </div>
            ) : (
              <>
                <p className="font-display text-lg font-semibold">Arraste um vídeo ou selecione um arquivo</p>
                <p className="mt-1 font-mono text-xs uppercase text-muted">MP4 · MOV · M4V</p>
                <p className="mx-auto mt-2 max-w-md text-xs text-muted">Envie apenas vídeos próprios ou que você tenha autorização para processar. O vídeo e o áudio ficam neste servidor.</p>
                <Button variant="primary" className="mt-4" onClick={() => input.current?.click()}>Importar vídeo</Button>
                <input ref={input} type="file" accept={ACCEPT.join(",")} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ""; }} />
              </>
            )}
          </div>
          <ErrorNote error={uploadError} />
          <Card title="Vídeos">
            {project?.videos?.length ? (
              <ul className="divide-y divide-line">
                {project.videos.map((v) => (
                  <li key={v.id}>
                    <Link href={`/videos/${v.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-orange">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{v.filename}</p>
                        <p className="font-mono text-[11px] text-muted">{fmtDur(v.duration)} · {v.resolution} · {fmtSize(v.size_bytes)} · {fmtDate(v.created_at)}</p>
                      </div>
                      <Badge status={v.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Nenhum vídeo importado neste projeto.</p>}
          </Card>
        </div>
        <Card title="Histórico de processamento">
          {jobs.length ? <div className="space-y-2">{jobs.map((j) => <JobRow key={j.id} job={j} onChange={refresh} />)}</div>
            : <p className="text-sm text-muted">Sem processamentos ainda.</p>}
        </Card>
      </div>
    </Shell>
  );
}
