"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Flag, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSetFeatureFlag } from "@/hooks/use-admin";
import type { FeatureFlagSummary } from "@/lib/api/types";

function FeatureFlagRow({ flag }: { flag: FeatureFlagSummary }) {
  const setFlag = useSetFeatureFlag();
  const [rollout, setRollout] = useState(flag.rollout_percentage);

  function handleToggle(enabled: boolean) {
    setFlag.mutate(
      { key: flag.key, input: { enabled, rollout_percentage: rollout } },
      { onError: () => toast.error(`Não foi possível atualizar "${flag.key}".`) }
    );
  }

  function handleRolloutCommit() {
    if (rollout === flag.rollout_percentage) return;
    setFlag.mutate(
      { key: flag.key, input: { enabled: flag.enabled, rollout_percentage: rollout } },
      { onError: () => toast.error(`Não foi possível atualizar "${flag.key}".`) }
    );
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm font-medium">{flag.key}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor={`rollout-${flag.key}`} className="text-xs text-muted-foreground">
            Rollout %
          </Label>
          <Input
            id={`rollout-${flag.key}`}
            type="number"
            min={0}
            max={100}
            value={rollout}
            onChange={(e) => setRollout(Number(e.target.value))}
            onBlur={handleRolloutCommit}
            className="h-8 w-20"
            disabled={setFlag.isPending}
          />
        </div>
        <Switch
          checked={flag.enabled}
          onCheckedChange={handleToggle}
          disabled={setFlag.isPending}
          aria-label={`Ativar ${flag.key}`}
        />
      </div>
    </div>
  );
}

function CreateFeatureFlagForm() {
  const setFlag = useSetFeatureFlag();
  const [key, setKey] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;
    setFlag.mutate(
      { key: trimmed, input: { enabled: false, rollout_percentage: 100 } },
      {
        onSuccess: () => {
          setKey("");
          toast.success(`Flag "${trimmed}" criada (desabilitada por padrão).`);
        },
        onError: () => toast.error("Não foi possível criar a flag."),
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex items-end gap-2 border-b border-border pb-4">
      <div className="flex-1 space-y-1">
        <Label htmlFor="new-flag-key" className="text-xs text-muted-foreground">
          Nova flag (chave)
        </Label>
        <Input
          id="new-flag-key"
          placeholder="ex.: new_dashboard"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="h-9 font-mono text-sm"
        />
      </div>
      <Button type="submit" size="sm" variant="outline" isLoading={setFlag.isPending} disabled={!key.trim()}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Criar
      </Button>
    </form>
  );
}

export function FeatureFlagsPanel({ flags }: { flags: FeatureFlagSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature flags</CardTitle>
        <CardDescription>
          Ativação e rollout gradual (determinístico por usuário) — sem precisar de novo deploy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateFeatureFlagForm />
        {flags.length === 0 ? (
          <EmptyState
            icon={<Flag className="h-8 w-8" aria-hidden="true" />}
            title="Nenhuma flag criada ainda"
            description="Crie a primeira flag acima."
          />
        ) : (
          <div>
            {flags.map((flag) => (
              <FeatureFlagRow key={flag.key} flag={flag} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
