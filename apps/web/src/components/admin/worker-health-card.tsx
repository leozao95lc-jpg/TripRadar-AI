import { CheckCircle2, XCircle } from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils";
import type { ProviderCircuitState, WorkerRun } from "@/lib/api/types";

const CIRCUIT_STATE_LABEL: Record<ProviderCircuitState, string> = {
  closed: "circuito fechado",
  half_open: "circuito testando",
  open: "circuito aberto",
};

const CIRCUIT_STATE_VARIANT: Record<ProviderCircuitState, BadgeProps["variant"]> = {
  closed: "success",
  half_open: "warning",
  open: "destructive",
};

function ProviderTelemetryRow({ run }: { run: WorkerRun }) {
  if (!run.provider_name) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
      <span className="font-mono">{run.provider_name}</span>
      <span>{run.provider_requests} requisições</span>
      <span>{run.provider_requests_failed} falharam</span>
      <span>
        cache {run.provider_cache_hits}/{run.provider_cache_hits + run.provider_cache_misses}
      </span>
      {run.provider_fallback_used > 0 ? (
        <span className="text-warning-foreground">{run.provider_fallback_used}x usou fallback</span>
      ) : null}
      {run.provider_circuit_state ? (
        <Badge variant={CIRCUIT_STATE_VARIANT[run.provider_circuit_state]}>
          {CIRCUIT_STATE_LABEL[run.provider_circuit_state]}
        </Badge>
      ) : null}
    </div>
  );
}

export function WorkerHealthCard({ workerRuns }: { workerRuns: WorkerRun[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saúde dos workers</CardTitle>
        <CardDescription>Última execução registrada de cada job em batch.</CardDescription>
      </CardHeader>
      <CardContent>
        {workerRuns.length === 0 ? (
          <EmptyState
            icon={<XCircle className="h-8 w-8" aria-hidden="true" />}
            title="Nenhum worker rodou ainda"
            description="Assim que o job de polling rodar pela primeira vez, o heartbeat aparece aqui."
          />
        ) : (
          <ul className="space-y-3">
            {workerRuns.map((run) => (
              <li key={run.worker_name} className="rounded-md border border-border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    {run.success ? (
                      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                    )}
                    <span className="font-mono text-sm font-medium">{run.worker_name}</span>
                    <Badge variant={run.success ? "success" : "destructive"}>
                      {run.success ? "OK" : "Com falhas"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {run.routes_ok} rota(s) ok, {run.routes_failed} falha(s) · última execução{" "}
                    {formatDateTime(run.recorded_at)}
                  </div>
                </div>
                <ProviderTelemetryRow run={run} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
