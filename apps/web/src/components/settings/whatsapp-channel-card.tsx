"use client";

import { useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useSetNotificationPreference, useVerifyNotificationChannel } from "@/hooks/use-notifications";
import { ApiError } from "@/lib/api/client";
import type { NotificationPreference } from "@/lib/api/types";

export function WhatsAppChannelCard({ preference }: { preference: NotificationPreference | undefined }) {
  const setPreference = useSetNotificationPreference();
  const verifyChannel = useVerifyNotificationChannel();

  const [phone, setPhone] = useState(preference?.destination ?? "");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [awaitingCode, setAwaitingCode] = useState(false);

  const isVerified = preference?.enabled ?? false;
  const isPending = (preference?.pending_verification ?? false) || awaitingCode;

  async function handleRequestCode(event: FormEvent) {
    event.preventDefault();
    try {
      await setPreference.mutateAsync({ channel: "whatsapp", destination: phone, enabled: true });
      setAwaitingCode(true);
      toast.success("Enviamos um código de verificação para o seu WhatsApp.");
    } catch {
      toast.error("Não foi possível enviar o código agora. Tente novamente.");
    }
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();
    setCodeError(null);
    try {
      await verifyChannel.mutateAsync({ channel: "whatsapp", code });
      setAwaitingCode(false);
      setCode("");
      toast.success("WhatsApp confirmado!");
    } catch (error) {
      setCodeError(
        error instanceof ApiError && error.status === 400
          ? "Código inválido ou expirado."
          : "Não foi possível confirmar agora."
      );
    }
  }

  async function handleToggle(checked: boolean) {
    try {
      await setPreference.mutateAsync({ channel: "whatsapp", destination: preference!.destination, enabled: checked });
      toast.success(checked ? "WhatsApp ativado." : "WhatsApp desativado.");
    } catch {
      toast.error("Não foi possível atualizar agora. Tente novamente.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <CardTitle className="flex items-center gap-2">
            WhatsApp
            {isPending ? <Badge variant="warning">Aguardando confirmação</Badge> : null}
          </CardTitle>
          <CardDescription>Alertas instantâneos direto no seu WhatsApp (Premium).</CardDescription>
        </div>
        {isVerified ? (
          <Switch
            checked={isVerified}
            onCheckedChange={handleToggle}
            disabled={setPreference.isPending}
            aria-label="Ativar notificações por WhatsApp"
          />
        ) : null}
      </CardHeader>
      <CardContent>
        {isVerified ? (
          <p className="text-sm text-muted-foreground">Número confirmado: {preference?.destination}</p>
        ) : isPending ? (
          <form onSubmit={handleConfirm} className="space-y-3" noValidate>
            <p className="text-sm text-muted-foreground">
              Digite o código de 6 dígitos enviado para {phone || preference?.destination}.
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="whatsapp-code">Código</Label>
                <Input
                  id="whatsapp-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  invalid={Boolean(codeError)}
                  aria-describedby={codeError ? "whatsapp-code-error" : undefined}
                />
              </div>
              <Button type="submit" isLoading={verifyChannel.isPending} disabled={code.length !== 6}>
                Confirmar
              </Button>
            </div>
            {codeError ? (
              <p id="whatsapp-code-error" role="alert" className="text-sm text-destructive">
                {codeError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleRequestCode}
              className="text-sm text-primary hover:underline"
              disabled={setPreference.isPending}
            >
              Reenviar código
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestCode} className="space-y-3" noValidate>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-phone">Número do WhatsApp</Label>
              <Input
                id="whatsapp-phone"
                type="tel"
                placeholder="+55 11 99999-9999"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button type="submit" isLoading={setPreference.isPending} disabled={!phone.trim()}>
              Enviar código de verificação
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
