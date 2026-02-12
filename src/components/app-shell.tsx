"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type ReactNode, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CirclePlus,
  Home,
  Info,
  ListChecks,
  LogOut,
  Newspaper,
  Shield,
  Trophy,
  UserCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { queryKeys, usePendingActionCount } from "@/lib/queries";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const baseNavItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/noticias", label: "Noticias", icon: Newspaper },
  { href: "/partidas", label: "Partidas", icon: ListChecks },
  { href: "/ranking", label: "Ranking", icon: Trophy },
];

const adminNavItem: NavItem = { href: "/admin", label: "Admin", icon: Shield };
const profileNavItem: NavItem = { href: "/perfil", label: "Perfil", icon: UserCircle };

export function AppShell({
  title,
  subtitle,
  children,
  showBack = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  showBack?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading, logout, canAccessAdmin } = useAuth();
  const { data: pendingActionsCount = 0 } = usePendingActionCount(user?.id);
  const hasPendingAlert = !loading && !!user && pendingActionsCount > 0;

  // Construir navItems dinamicamente baseado nas permissoes
  const navItems = useMemo(() => {
    const items = [...baseNavItems];
    if (canAccessAdmin) {
      items.push(adminNavItem);
    }
    items.push(profileNavItem);
    return items;
  }, [canAccessAdmin]);

  const active = useMemo(
    () => navItems.find((item) => pathname === item.href)?.href,
    [pathname, navItems]
  );

  const handleLogout = async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };

  const handlePendingCtaClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== "/partidas") return;

    e.preventDefault();
    await queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
    await queryClient.refetchQueries({
      queryKey: queryKeys.matches.all,
      type: "active",
    });

    if (user?.id) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.matches.pendingActions(user.id),
      });
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f4fa] text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center bg-primary text-primary-foreground shadow-xl ring-1 ring-primary">
        <div className="w-full max-w-[440px]">
          <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
            {showBack ? (
              <button
                onClick={() => router.back()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/10 text-primary-foreground transition hover:bg-primary-foreground/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            <div className="flex-1 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground/80">
                Smash Pong
              </p>
              <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
              {subtitle ? (
                <p className="text-xs text-primary-foreground/80">{subtitle}</p>
              ) : null}
            </div>
            {!loading && user ? (
              <div className="flex items-center gap-2">
                <span className="max-w-[80px] truncate rounded-full bg-primary-foreground/20 px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                  {user.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/10 text-primary-foreground transition hover:bg-primary-foreground/20"
                  aria-label="Sair"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : !loading ? (
              <Link
                href="/login"
                className="rounded-full bg-primary-foreground/20 px-3 py-1 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary-foreground/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
              >
                Login
              </Link>
            ) : null}
          </div>

          {hasPendingAlert ? (
            <div className="px-4 pb-3 sm:px-6">
              <div className="flex items-center justify-between gap-2 rounded-xl bg-primary-foreground/12 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Info className="h-4 w-4 shrink-0 text-primary-foreground" />
                  <p className="truncate text-xs font-medium text-primary-foreground">
                    Você tem {pendingActionsCount} pendência(s) para confirmar
                  </p>
                </div>
                <Link
                  href="/partidas"
                  onClick={handlePendingCtaClick}
                  className="shrink-0 rounded-full bg-primary-foreground/20 px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary-foreground/30"
                >
                  Ver agora
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div
        className={`mx-auto flex w-full max-w-[420px] flex-col gap-8 px-4 pb-32 sm:px-6 ${
          hasPendingAlert ? "pt-48" : "pt-32"
        }`}
      >
        <section className="rounded-3xl bg-card p-5 shadow-xl ring-1 ring-border">
          {children}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[440px] items-center justify-between px-3 py-3 sm:px-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold transition ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                <span className="relative">
                  <Icon
                    className={`h-5 w-5 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  {item.href === "/partidas" && pendingActionsCount > 0 ? (
                    <span className="absolute -right-2 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {pendingActionsCount > 99 ? "99+" : pendingActionsCount}
                    </span>
                  ) : null}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

{pathname !== "/registrar-jogo" && (
        <Link
          href="/registrar-jogo"
          className="fixed bottom-20 left-1/2 z-[60] inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:bottom-16"
        >
          <CirclePlus className="h-5 w-5" />
          Registrar jogo
        </Link>
      )}
    </main>
  );
}
