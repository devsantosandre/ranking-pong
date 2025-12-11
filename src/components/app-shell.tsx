"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type ReactNode, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart2,
  CirclePlus,
  Home,
  ListChecks,
  Newspaper,
  Trophy,
  UserCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/partidas", label: "Partidas", icon: ListChecks },
  { href: "/noticias", label: "Notícias", icon: Newspaper },
  { href: "/perfil", label: "Perfil", icon: UserCircle },
  { href: "/estatisticas", label: "Stats", icon: BarChart2 },
];

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
  const [mounted] = useState(typeof window !== "undefined");
  const active = useMemo(
    () => navItems.find((item) => pathname === item.href)?.href,
    [pathname],
  );
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-[#f5f4fa] text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center bg-primary text-primary-foreground shadow-xl ring-1 ring-primary">
        <div className="flex w-full max-w-[440px] items-center gap-3 px-4 py-4 sm:px-6">
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
          <Link
            href="/login"
            className="rounded-full bg-primary-foreground/20 px-3 py-1 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary-foreground/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
          >
            {mounted && user ? user.name : "Login"}
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-8 px-4 pb-32 pt-28 sm:px-6">
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
                <Icon
                  className={`h-5 w-5 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <Link
        href="/registrar-jogo"
        className="fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex items-center gap-2">
          <CirclePlus className="h-5 w-5" />
          Registrar jogo
        </span>
      </Link>
    </main>
  );
}
