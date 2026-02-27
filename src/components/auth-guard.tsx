"use client";

import { useAuth } from "@/lib/auth-store";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShellLoadingSkeleton } from "@/components/skeletons/app-shell-loading-skeleton";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  // Mostra loading apenas durante a verificação inicial da autenticação
  // O middleware já garante que usuários não autenticados não acessam rotas protegidas.
  // Exceção: na tela de login não bloqueamos o render para evitar atraso no FCP/LCP.
  if (loading && !isLoginPage) {
    return <AppShellLoadingSkeleton />;
  }

  return <>{children}</>;
}
