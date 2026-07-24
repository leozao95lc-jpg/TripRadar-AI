"use client";

import { Mail } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth/auth-context";
import { useSetNotificationPreference } from "@/hooks/use-notifications";
import type { NotificationPreference } from "@/lib/api/types";

export function EmailChannelCard({ preference }: { preference: NotificationPreference | undefined }) {
  const { user } = useAuth();
  const setPreference = useSetNotificationPreference();
  const enabled = preference?.enabled ?? true;

  async function handleToggle(checked: boolean) {
    try {
      await setPreference.mutateAsync({ channel: "email", destination: user?.email ?? "", enabled: checked });
      toast.success(checked ? "E-mail ativado." : "E-mail desativado.");
    } catch {
      toast.error("Não foi possível atualizar agora. Tente novamente.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <CardTitle>E-mail</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={setPreference.isPending}
          aria-label="Ativar notificações por e-mail"
        />
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Sempre o e-mail da sua conta — por segurança, não é possível apontar este canal para outro endereço.
        </p>
      </CardContent>
    </Card>
  );
}
