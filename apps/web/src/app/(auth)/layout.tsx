"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/lib/auth/auth-context";
import { Spinner } from "@/components/ui/spinner";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Verificando sessão" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          T
        </span>
        TripRadar AI
      </Link>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
