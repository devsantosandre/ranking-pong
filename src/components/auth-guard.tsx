"use client";

import { useAuth } from "@/lib/auth-store";
import type { ReactNode } from "react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { loading } = useAuth();

  // Mostra loading apenas durante a verificação inicial da autenticação
  // O middleware já garante que usuários não autenticados não acessam rotas protegidas
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
