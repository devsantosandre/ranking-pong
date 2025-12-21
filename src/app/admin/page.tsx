"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import Link from "next/link";
import {
  Gamepad2,
  Users,
  Settings,
  History,
  ChevronRight,
  Shield,
} from "lucide-react";

const adminSections = [
  {
    href: "/admin/partidas",
    label: "Partidas",
    icon: Gamepad2,
    description: "Gerenciar e cancelar partidas",
    color: "text-blue-600 bg-blue-100",
  },
  {
    href: "/admin/jogadores",
    label: "Jogadores",
    icon: Users,
    description: "Adicionar jogadores, resetar senhas",
    color: "text-green-600 bg-green-100",
  },
  {
    href: "/admin/configuracoes",
    label: "Configuracoes",
    icon: Settings,
    description: "Regras de pontuacao e limites",
    color: "text-orange-600 bg-orange-100",
    adminOnly: true,
  },
  {
    href: "/admin/logs",
    label: "Historico",
    icon: History,
    description: "Ver acoes administrativas",
    color: "text-purple-600 bg-purple-100",
  },
];

export default function AdminPage() {
  const { user, isAdmin } = useAuth();

  return (
    <AppShell
      title="Admin"
      subtitle={`Logado como ${isAdmin ? "Administrador" : "Moderador"}`}
    >
      <div className="space-y-4">
        {/* Header com role */}
        <div className="flex items-center gap-3 rounded-xl bg-primary/10 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{user?.name}</p>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Admin Completo" : "Moderador"}
            </p>
          </div>
        </div>

        {/* Secoes */}
        <div className="space-y-3">
          {adminSections.map((section) => {
            // Pular configuracoes se nao for admin
            if (section.adminOnly && !isAdmin) {
              return null;
            }

            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${section.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {section.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
