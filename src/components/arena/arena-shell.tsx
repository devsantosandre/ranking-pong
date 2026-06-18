"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type ReactNode, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  CirclePlus,
  Home,
  ListChecks,
  MoreHorizontal,
  Newspaper,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { usePendingConfirmationStatus } from "@/lib/queries";
import { buildBrowserTitle } from "@/lib/app-title";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { href: "/",         label: "Home",     icon: Home },
  { href: "/noticias", label: "Notícias", icon: Newspaper },
  { href: "/partidas", label: "Partidas", icon: ListChecks },
  { href: "/ranking",  label: "Ranking",  icon: Trophy },
  { href: "/mais",     label: "Mais",     icon: MoreHorizontal },
];

const maisChildRoutes = ["/mais", "/temporadas", "/perfil", "/admin", "/regras", "/tv"];

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/mais") {
    return maisChildRoutes.some((r) =>
      r === "/" ? pathname === "/" : pathname === r || pathname.startsWith(`${r}/`)
    );
  }
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? "?").toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

interface ArenaShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  showBack?: boolean;
  layoutWidth?: "compact" | "wide" | "full";
}

export function ArenaShell({
  title,
  subtitle,
  children,
  showBack = false,
  layoutWidth = "compact",
}: ArenaShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { data: pendingStatus } = usePendingConfirmationStatus(user?.id);
  const pendingActionsCount = pendingStatus?.pendingActionsCount ?? 0;

  const active = useMemo(
    () => navItems.find((item) => isActiveRoute(pathname, item.href))?.href,
    [pathname],
  );

  useEffect(() => {
    document.title = buildBrowserTitle(title);
  }, [title]);

  const widthClass = layoutWidth === "full" ? "max-w-none" : layoutWidth === "wide" ? "max-w-[1040px]" : "max-w-[440px]";

  return (
    <>
      {/* Header primário */}
      <header
        className="fixed inset-x-0 top-0 z-50 flex justify-center"
        style={{
          background: "var(--arena-primary)",
          boxShadow: "0 2px 16px color-mix(in srgb, var(--arena-primary) 35%, transparent)",
        }}
      >
        <div className={`w-full ${layoutWidth === "wide" ? "max-w-[1120px]" : "max-w-[440px]"}`}>
          <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
            {showBack && (
              <button
                onClick={() => router.back()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/15"
                aria-label="Voltar"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className="flex-1 space-y-0.5">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                Smash Pong App
              </p>
              <h1
                className="text-xl font-bold sm:text-2xl"
                style={{
                  color: "#ffffff",
                  fontFamily: "var(--font-display)",
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {subtitle}
                </p>
              )}
            </div>
            {!loading && user && (
              <Link
                href="/perfil"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition hover:opacity-90"
                style={{
                  background: "rgba(255,255,255,0.22)",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.3)",
                }}
                aria-label="Perfil"
              >
                {getInitials(user.name)}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className={`mx-auto w-full ${widthClass} ${layoutWidth === "full" ? "px-0" : "px-4 sm:px-6"} pb-32 pt-28`}>
        {children}
      </div>

      {/* Nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50"
        style={{
          background: "var(--glass-bg-strong)",
          backdropFilter: "blur(var(--glass-blur))",
          borderTop: "1px solid var(--glass-border)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[440px] items-center justify-between px-3 py-3 sm:px-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold transition"
                style={{
                  color: isActive ? "var(--arena-primary)" : "var(--arena-muted)",
                  background: isActive
                    ? "color-mix(in srgb, var(--arena-primary) 12%, transparent)"
                    : "transparent",
                }}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {item.href === "/partidas" && pendingActionsCount > 0 && (
                    <span className="absolute -right-2 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {pendingActionsCount > 99 ? "99+" : pendingActionsCount}
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* FAB registrar jogo */}
      {pathname !== "/registrar-jogo" && (
        <Link
          href="/registrar-jogo"
          className="fixed bottom-20 left-1/2 z-[60] inline-flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-white shadow-xl transition hover:scale-[1.03] sm:bottom-16"
          style={{
            background: "var(--arena-primary)",
            boxShadow: "0 8px 24px rgba(164,33,210,0.35)",
          }}
        >
          <CirclePlus className="h-5 w-5" />
          Registrar jogo
        </Link>
      )}
    </>
  );
}
