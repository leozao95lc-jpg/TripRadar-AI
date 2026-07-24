"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/auth/password-input";
import { useAuth } from "@/lib/auth/auth-context";
import { friendlyAuthError } from "@/lib/api/error-messages";

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setPasswordError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, fullName);
      router.replace("/dashboard");
    } catch (error) {
      setFormError(friendlyAuthError(error, "register"));
      nameRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Leva menos de um minuto — grátis para começar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError ? (
            <Alert variant="destructive" role="alert">
              {formError}
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="full_name">Nome completo</Label>
            <Input
              ref={nameRef}
              id="full_name"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? "password-error" : "password-hint"}
            />
            {passwordError ? (
              <p id="password-error" role="alert" className="text-sm text-destructive">
                {passwordError}
              </p>
            ) : (
              <p id="password-hint" className="text-sm text-muted-foreground">
                Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Criar conta
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
