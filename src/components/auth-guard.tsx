"use client";

import { useAuth } from "@/lib/auth-store";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  // Mostra loading apenas durante a verificação inicial da autenticação
  // O middleware já garante que usuários não autenticados não acessam rotas protegidas.
  // Exceção: na tela de login não bloqueamos o render para evitar atraso no FCP/LCP.
  if (loading && !isLoginPage) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
