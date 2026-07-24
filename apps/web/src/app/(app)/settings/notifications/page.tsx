"use client";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmailChannelCard } from "@/components/settings/email-channel-card";
import { WhatsAppChannelCard } from "@/components/settings/whatsapp-channel-card";
import { useNotificationPreferences } from "@/hooks/use-notifications";

export default function NotificationSettingsPage() {
  const { data: preferences, isLoading, isError, refetch, isFetching } = useNotificationPreferences();

  const emailPreference = preferences?.find((p) => p.channel === "email");
  const whatsappPreference = preferences?.find((p) => p.channel === "whatsapp");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notificações</h1>
        <p className="text-sm text-muted-foreground">Escolha por onde você quer receber os alertas de preço.</p>
      </div>

      {isError ? (
        <Alert
          variant="destructive"
          role="alert"
          className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>Não foi possível carregar suas preferências agora.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching}>
            Tentar novamente
          </Button>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <EmailChannelCard preference={emailPreference} />
          <WhatsAppChannelCard preference={whatsappPreference} />
        </div>
      )}
    </div>
  );
}
