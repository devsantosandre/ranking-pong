"use client";

import { AppShell } from "@/components/app-shell";
import { useActiveSeason, useClosedSeasons, useSeasonStandings } from "@/lib/queries";
import { Loader2, Trophy, Medal, Clock } from "lucide-react";
import Link from "next/link";

function formatDateRange(startsAt: string, endsAt: string): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${fmt(startsAt)} – ${fmt(endsAt)}`;
}

function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "encerrando…";
  const days = Math.floor(diff / 86_400_000);
  if (days >= 2) return `${days} dias restantes`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `${hours}h restantes`;
  return "< 1h";
}

function getSeasonProgress(startsAt: string, endsAt: string): number {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const total = end - start;
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((now - start) / total) * 100)));
}

function getPlayerName(player: {
  full_name: string | null;
  name: string | null;
  email: string | null;
}): string {
  return player.full_name || player.name || player.email?.split("@")[0] || "Jogador";
}

function ActiveSeasonCard() {
  const { data: activeSeason, isLoading } = useActiveSeason();
  const { data: standings, isLoading: standingsLoading } = useSeasonStandings(
    activeSeason?.id
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeSeason) return null;

  const top3 = (standings ?? []).slice(0, 3);
  const countdown = formatCountdown(activeSeason.ends_at);
  const progress = getSeasonProgress(activeSeason.starts_at, activeSeason.ends_at);

  return (
    <article className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Medal className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold text-primary">{activeSeason.name}</p>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
            ativa
          </span>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {countdown}
        </span>
      </div>

      <div className="mb-3 h-1.5 w-full rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {standingsLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : top3.length > 0 ? (
        <div className="space-y-1.5">
          {top3.map((entry, idx) => {
            const medals = ["🥇", "🥈", "🥉"];
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl bg-background/60 px-3 py-2"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span>{medals[idx]}</span>
                  <span className="truncate max-w-[160px]">
                    {getPlayerName(entry)}
                  </span>
                </span>
                <span className="text-sm font-bold text-primary">
                  {entry.points} pts
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Nenhum jogo registrado ainda nesta temporada.
        </p>
      )}

      <Link
        href="/ranking"
        className="mt-3 block w-full rounded-xl bg-primary py-2 text-center text-xs font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Ver ranking completo →
      </Link>
    </article>
  );
}

export default function TemporadasPage() {
  const { data: closedSeasons, isLoading } = useClosedSeasons();

  return (
    <AppShell title="Temporadas" subtitle="Hall da Fama">
      <div className="space-y-6">
        <ActiveSeasonCard />

        <div className="space-y-3">
          <p className="px-1 text-sm font-semibold text-foreground">
            Hall da Fama
          </p>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !closedSeasons || closedSeasons.length === 0 ? (
            <article className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
              <Trophy className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Nenhuma temporada encerrada ainda.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Os campeões aparecerão aqui quando a primeira temporada for encerrada.
              </p>
            </article>
          ) : (
            closedSeasons.map((season, idx) => {
              const champion = season.champion;
              const championName = champion ? getPlayerName(champion) : null;

              return (
                <article
                  key={season.id}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    idx === 0
                      ? "border-yellow-300 bg-yellow-50"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                          idx === 0
                            ? "bg-yellow-200"
                            : "bg-muted"
                        }`}
                      >
                        {idx === 0 ? "🏆" : "🥈"}
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`font-bold ${
                            idx === 0 ? "text-yellow-800" : "text-foreground"
                          }`}
                        >
                          {season.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateRange(season.starts_at, season.ends_at)}
                        </p>
                        {championName ? (
                          <p
                            className={`mt-1 text-sm font-semibold ${
                              idx === 0 ? "text-yellow-700" : "text-primary"
                            }`}
                          >
                            🥇 {championName}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground italic">
                            Sem campeão registrado
                          </p>
                        )}
                      </div>
                    </div>
                    {season.closed_at && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        encerrada
                      </span>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
