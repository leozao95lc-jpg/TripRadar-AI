import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva("flex items-start gap-3 rounded-md border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-border bg-muted text-foreground",
      success: "border-success/30 bg-success/10 text-success",
      warning: "border-warning/30 bg-warning/15 text-warning-foreground",
      destructive: "border-destructive/30 bg-destructive/10 text-destructive",
    },
  },
  defaultVariants: { variant: "info" },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, role, ...props }: AlertProps) {
  return (
    <div
      role={role ?? (variant === "destructive" ? "alert" : "status")}
      className={cn(alertVariants({ variant, className }))}
      {...props}
    />
  );
}
