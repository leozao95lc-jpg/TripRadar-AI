"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { KpiCard } from "@/components/admin/kpi-card";
import { WorkerHealthCard } from "@/components/admin/worker-health-card";
import { FeatureFlagsPanel } from "@/components/admin/feature-flags-panel";
import { useAdminDashboard } from "@/hooks/use-admin";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDateTime } from "@/lib/utils";

function BreakdownCard({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados nos últimos 7 dias.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map(([name, count]) => (
              <li key={name} className="flex items-center justify-between text-sm">
                <span className="font-mono text-muted-foreground">{name}</span>
                <span className="font-medium tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAuthLoading && user && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, isAdmin, router]);

  const { data, isLoading, isError, refetch, isFetching } = useAdminDashboard(isAdmin);

  if (isAuthLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Verificando permissões" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Redirecionando" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          Admin
        </h1>
        <p className="text-sm text-muted-foreground">
          Visão operacional do produto — só visível para contas com papel de administrador.
        </p>
      </div>

      {isError ? (
        <Alert
          variant="destructive"
          role="alert"
          className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>Não foi possível carregar o dashboard administrativo agora.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching}>
            Tentar novamente
          </Button>
        </Alert>
      ) : isLoading || !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Usuários totais" value={data.users_total} hint={`+${data.users_new_7d} nos últimos 7 dias`} />
            <KpiCard label="Alertas ativos" value={data.alerts_active_total} hint={`${data.alerts_created_7d} criados em 7 dias`} />
            <KpiCard label="Disparos (7d)" value={data.alert_triggers_7d} />
            <KpiCard label="Snapshots de preço (24h)" value={data.price_snapshots_24h} />
          </div>

          <WorkerHealthCard workerRuns={data.worker_runs} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <BreakdownCard title="Notificações por canal (7d)" counts={data.notifications_sent_7d_by_channel} />
            <BreakdownCard title="Notificações por status (7d)" counts={data.notifications_sent_7d_by_status} />
            <BreakdownCard title="Eventos de produto (7d)" counts={data.product_events_7d} />
          </div>

          <FeatureFlagsPanel flags={data.feature_flags} />

          <p className="text-xs text-muted-foreground">
            Atualizado {formatDateTime(data.generated_at)} · atualiza automaticamente a cada 30s.
          </p>
        </>
      )}
    </div>
  );
}
