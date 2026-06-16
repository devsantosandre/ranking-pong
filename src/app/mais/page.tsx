"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import { BookOpen, Medal, Shield, Tv, UserCircle } from "lucide-react";
import Link from "next/link";

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

export default function MaisPage() {
  const { canAccessAdmin } = useAuth();

  const items = canAccessAdmin ? [...menuItems, adminItem] : menuItems;

  return (
    <AppShell title="Menu" subtitle="Acesso rápido">
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
    </AppShell>
  );
}
