"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button, ErrorNote, Field } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/auth/login", { method: "POST", json: { password } });
      router.replace("/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6">
        <div>
          <h1 className="text-3xl font-extrabold">CLIP STUDIO <span className="text-orange">AI</span></h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">acesso privado</p>
        </div>
        <Field label="Senha">
          <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorNote error={error} />
        <Button variant="primary" className="w-full" disabled={busy || !password}>Entrar</Button>
      </form>
    </div>
  );
}
