"use client";

import { useAuth } from "@/lib/auth-store";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShellLoadingSkeleton } from "@/components/skeletons/app-shell-loading-skeleton";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace("/login");
    }
  }, [loading, user, isLoginPage, router]);

  // Enquanto verifica autenticação
  if (loading && !isLoginPage) {
    return <AppShellLoadingSkeleton />;
  }

  // Sem usuário fora da página de login: bloqueia conteúdo até o redirect concluir
  if (!user && !isLoginPage) {
    return <AppShellLoadingSkeleton />;
  }

  return <>{children}</>;
}
