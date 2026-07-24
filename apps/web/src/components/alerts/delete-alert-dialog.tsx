"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteAlert } from "@/hooks/use-alerts";
import type { SearchAlert } from "@/lib/api/types";

export function DeleteAlertDialog({
  alert,
  onDeleted,
  trigger,
}: {
  alert: SearchAlert;
  onDeleted?: () => void;
  trigger?: React.ReactNode;
}) {
  const deleteAlert = useDeleteAlert();

  async function handleConfirm() {
    try {
      await deleteAlert.mutateAsync(alert.id);
      toast.success("Alerta excluído.");
      onDeleted?.();
    } catch {
      toast.error("Não foi possível excluir o alerta. Tente novamente.");
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Excluir alerta ${alert.origin_iata} para ${alert.destination_iata}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Excluir alerta?</AlertDialogTitle>
        <AlertDialogDescription>
          Você vai parar de receber notificações para {alert.origin_iata} → {alert.destination_iata}. Essa
          ação não pode ser desfeita.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={deleteAlert.isPending}>
            {deleteAlert.isPending ? "Excluindo…" : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
