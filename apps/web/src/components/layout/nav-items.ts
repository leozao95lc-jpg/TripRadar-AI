import { Bell, LayoutDashboard, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/alerts", label: "Alertas", icon: Bell },
  { href: "/settings/notifications", label: "Configurações", icon: Settings },
] as const;
