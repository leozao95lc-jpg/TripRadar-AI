"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Project } from "@/lib/api";
import { Button, ErrorNote, Field, Modal } from "./ui";

export default function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const p = await api<Project>("/projects", { method: "POST", json: { name, description } });
      router.push(`/projects/${p.id}`);
    } catch (err) { setError((err as Error).message); }
  };
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>+ Novo projeto</Button>
      {open && (
        <Modal title="Novo projeto" onClose={() => setOpen(false)}>
          <form onSubmit={create} className="space-y-4">
            <Field label="Nome"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></Field>
            <Field label="Descrição"><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <ErrorNote error={error} />
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button variant="primary" disabled={!name.trim()}>Criar projeto</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
