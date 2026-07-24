import { CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils";
import type { WorkerRun } from "@/lib/api/types";

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
              <li
                key={run.worker_name}
                className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
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
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
