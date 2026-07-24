"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { MobileBottomNav, SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/auth-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-60 shrink-0 border-r border-border p-4 lg:block">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border lg:flex">
        <div className="flex h-16 items-center gap-2 px-4 text-lg font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            T
          </span>
          TripRadar
        </div>
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-base font-semibold lg:hidden">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm">
              T
            </span>
            TripRadar
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 px-4 pb-20 pt-6 sm:px-6 lg:pb-6">{children}</main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
