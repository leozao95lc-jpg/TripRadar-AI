import { Bell, LayoutDashboard, Settings, ShieldCheck } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard, adminOnly: false },
  { href: "/alerts", label: "Alertas", icon: Bell, adminOnly: false },
  { href: "/settings/notifications", label: "Configurações", icon: Settings, adminOnly: false },
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
] as const;
