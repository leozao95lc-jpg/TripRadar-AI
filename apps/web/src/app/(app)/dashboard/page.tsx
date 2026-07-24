"use client";

import Link from "next/link";
import { Bell, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertOverviewCard } from "@/components/dashboard/alert-overview-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { useAlerts } from "@/hooks/use-alerts";
import { useAuth } from "@/lib/auth/auth-context";

const FREE_PLAN_ALERT_LIMIT = 3;

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: alerts, isLoading, isError, refetch, isFetching } = useAlerts();

  const activeAlerts = alerts?.filter((a) => a.status === "active") ?? [];
  const firstName = user?.full_name.split(" ")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName}</h1>
          <p className="text-sm text-muted-foreground">
            {user?.plan === "free"
              ? `${activeAlerts.length} de ${FREE_PLAN_ALERT_LIMIT} alertas ativos no plano Gratuito`
              : `${activeAlerts.length} alertas ativos`}
          </p>
        </div>
        <Button asChild>
          <Link href="/alerts/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Criar alerta
          </Link>
        </Button>
      </div>

      {isError ? (
        <Alert variant="destructive" role="alert" className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>Não foi possível carregar seus alertas agora.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching}>
            Tentar novamente
          </Button>
        </Alert>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activeAlerts.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-8 w-8" aria-hidden="true" />}
          title="Você ainda não tem alertas"
          description="Crie um alerta para uma rota e a gente avisa quando o preço cair."
          action={
            <Button asChild>
              <Link href="/alerts/new">Criar meu primeiro alerta</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeAlerts.map((alert) => (
            <AlertOverviewCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      <RecentActivity />
    </div>
  );
}
