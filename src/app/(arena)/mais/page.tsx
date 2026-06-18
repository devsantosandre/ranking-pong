"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { useAuth } from "@/lib/auth-store";
import { clearClientSessionData } from "@/lib/client-session-cleanup";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, LogOut, Medal, Shield, Tv, UserCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type MenuCard = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "admin";
};

const menuItems: MenuCard[] = [
  {
    href: "/temporadas",
    label: "Temporadas",
    description: "Ranking e Hall da Fama",
    icon: Medal,
  },
  {
    href: "/perfil",
    label: "Perfil",
    description: "Seus dados e conquistas",
    icon: UserCircle,
  },
  {
    href: "/regras",
    label: "Regras",
    description: "Como funciona a pontuação",
    icon: BookOpen,
  },
  {
    href: "/tv",
    label: "Modo TV",
    description: "Placar para o telão",
    icon: Tv,
  },
];

const adminItem: MenuCard = {
  href: "/admin",
  label: "Painel Admin",
  description: "Gerenciar jogadores e partidas",
  icon: Shield,
  variant: "admin",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? "?").toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export default function MaisPage() {
  const { user, canAccessAdmin, logout } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const items = canAccessAdmin ? [...menuItems, adminItem] : menuItems;

  const handleLogout = async () => {
    queryClient.clear();
    clearClientSessionData();
    await logout();
    router.replace("/login");
  };

  return (
    <ArenaShell title="Menu" subtitle="Acesso rápido" showBack>
      <div className="space-y-4">
        {/* Card do usuário */}
        {user && (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{user.name}</p>
              {user.email && (
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              )}
            </div>
          </div>
        )}

        {/* Grid de atalhos */}
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => {
            const Icon = item.icon;
            const isAdmin = item.variant === "admin";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-start gap-3 rounded-2xl border p-4 shadow-sm transition active:scale-[0.98] ${
                  isAdmin
                    ? "border-orange-200 bg-orange-50 hover:border-orange-400"
                    : "border-border bg-card hover:border-primary"
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    isAdmin ? "bg-orange-100" : "bg-primary/10"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${isAdmin ? "text-orange-600" : "text-primary"}`}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      isAdmin ? "text-orange-800" : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </p>
                  <p
                    className={`text-xs ${
                      isAdmin ? "text-orange-600/80" : "text-muted-foreground"
                    }`}
                  >
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Sair */}
        <button
          onClick={() => setLogoutConfirmOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 active:scale-[0.99]"
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>
      </div>

      <ConfirmModal
        isOpen={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
        title="Sair da conta"
        description="Tem certeza que deseja sair? Você precisará fazer login novamente para acessar o app."
        confirmText="Sair"
        cancelText="Cancelar"
        variant="danger"
      />
    </ArenaShell>
  );
}
