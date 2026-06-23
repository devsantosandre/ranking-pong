"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { useAuth } from "@/lib/auth-store";
import Link from "next/link";
import {
  ShieldAlert,
  Gamepad2,
  Users,
  Settings,
  History,
  BarChart3,
  ChevronRight,
  ExternalLink,
  Shield,
  Tv,
  Medal,
  Trophy,
} from "lucide-react";

type AdminItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  description: string;
  token: string;
  adminOnly?: boolean;
  openInNewTab?: boolean;
};

type AdminGroup = {
  id: string;
  label: string;
  highlight?: boolean;
  adminOnly?: boolean;
  items: AdminItem[];
};

const adminGroups: AdminGroup[] = [
  {
    id: "operacoes",
    label: "Operações",
    items: [
      {
        href: "/admin/pendencias",
        label: "Pendências",
        icon: ShieldAlert,
        description: "Jogos abertos antes da confirmação automática",
        token: "var(--state-scheduled)",
      },
      {
        href: "/admin/partidas",
        label: "Partidas",
        icon: Gamepad2,
        description: "Gerenciar e cancelar partidas",
        token: "var(--state-active)",
      },
      {
        href: "/admin/jogadores",
        label: "Jogadores",
        icon: Users,
        description: "Adicionar jogadores, resetar senhas",
        token: "var(--state-played)",
      },
    ],
  },
  {
    id: "competicoes",
    label: "Competições",
    highlight: true,
    adminOnly: true,
    items: [
      {
        href: "/admin/temporadas",
        label: "Temporadas",
        icon: Medal,
        description: "Criar, encerrar e reabrir temporadas",
        token: "var(--state-scheduled)",
      },
      {
        href: "/admin/torneios",
        label: "Torneios",
        icon: Trophy,
        description: "Criar e gerenciar torneios, seeds e resultados",
        token: "var(--arena-primary)",
      },
    ],
  },
  {
    id: "app",
    label: "App",
    items: [
      {
        href: "/admin/metricas",
        label: "Métricas",
        icon: BarChart3,
        description: "Frequência, engajamento e status do app",
        token: "var(--state-active)",
      },
      {
        href: "/admin/configuracoes",
        label: "Configurações",
        icon: Settings,
        description: "Regras de pontuação e limites",
        token: "var(--arena-primary)",
        adminOnly: true,
      },
      {
        href: "/admin/logs",
        label: "Histórico",
        icon: History,
        description: "Ver ações administrativas",
        token: "var(--state-tbd)",
      },
      {
        href: "/tv",
        label: "Painel TV",
        icon: Tv,
        description: "Abrir placar ao vivo em nova aba",
        token: "var(--arena-primary)",
        openInNewTab: true,
      },
    ],
  },
];

function AdminItem({ section }: { section: AdminItem }) {
  const Icon = section.icon;
  return (
    <Link
      href={section.href}
      target={section.openInNewTab ? "_blank" : undefined}
      rel={section.openInNewTab ? "noopener noreferrer" : undefined}
    >
      <GlassCard noPadding className="group flex items-center justify-between gap-3 px-3 py-3 transition-all hover:scale-[1.01]">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: `color-mix(in srgb, ${section.token} 14%, transparent)`,
              color: section.token,
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-(--arena-foreground)">
              {section.label}
            </p>
            <p className="truncate text-xs text-(--arena-muted)">
              {section.description}
            </p>
          </div>
        </div>
        {section.openInNewTab ? (
          <ExternalLink className="h-5 w-5 shrink-0 text-(--arena-muted)" />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-(--arena-muted) transition group-hover:translate-x-0.5" />
        )}
      </GlassCard>
    </Link>
  );
}

export default function AdminPage() {
  const { user, isAdmin } = useAuth();

  return (
    <ArenaShell
      title="Admin"
      subtitle={`Logado como ${isAdmin ? "Administrador" : "Moderador"}`}
    >
      <div className="flex flex-col gap-4">
        {/* Cartão de identidade do operador */}
        <GlassCard variant="strong" glow="primary" className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--arena-primary) 18%, transparent)" }}
          >
            <Shield className="h-5 w-5 text-(--arena-primary)" />
          </div>
          <div className="min-w-0">
            <p
              className="truncate font-semibold text-(--arena-foreground)"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {user?.name}
            </p>
            <p className="text-xs text-(--arena-muted)">
              {isAdmin ? "Admin Completo" : "Moderador"}
            </p>
          </div>
        </GlassCard>

        {/* Grupos de seções */}
        {adminGroups.map((group) => {
          if (group.adminOnly && !isAdmin) return null;
          const visibleItems = group.items.filter((item) => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;

          if (group.highlight) {
            return (
              <div key={group.id} className="flex flex-col gap-2">
                <p className="px-1 text-xs font-semibold uppercase tracking-wider text-(--arena-primary)">
                  {group.label}
                </p>
                <div
                  className="flex flex-col gap-2 rounded-2xl p-2"
                  style={{
                    background: "color-mix(in srgb, var(--arena-primary) 6%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--arena-primary) 22%, transparent)",
                  }}
                >
                  {visibleItems.map((item) => (
                    <AdminItem key={item.href} section={item} />
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={group.id} className="flex flex-col gap-2">
              <p className="px-1 text-xs font-semibold uppercase tracking-wider text-(--arena-muted)">
                {group.label}
              </p>
              <div className="flex flex-col gap-2">
                {visibleItems.map((item) => (
                  <AdminItem key={item.href} section={item} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ArenaShell>
  );
}
