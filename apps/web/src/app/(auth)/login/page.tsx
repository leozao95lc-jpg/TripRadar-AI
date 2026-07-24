"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/auth/password-input";
import { useAuth } from "@/lib/auth/auth-context";
import { friendlyAuthError } from "@/lib/api/error-messages";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
    } catch (error) {
      setFormError(friendlyAuthError(error, "login"));
      emailRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse sua conta para ver seus alertas.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError ? (
            <Alert variant="destructive" role="alert">
              {formError}
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              ref={emailRef}
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={Boolean(formError)}
              aria-describedby={formError ? "login-error" : undefined}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={Boolean(formError)}
            />
          </div>

          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Entrar
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link href="/registro" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
