"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth/auth-context";

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Menu do usuário"
        >
          <Avatar>
            <AvatarFallback>{initials(user.full_name)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">{user.full_name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          <Badge variant={user.plan === "premium" ? "primary" : "neutral"} className="mt-1 w-fit">
            Plano {user.plan === "premium" ? "Premium" : "Gratuito"}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings/notifications")}>
          <UserIcon className="h-4 w-4" aria-hidden="true" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
