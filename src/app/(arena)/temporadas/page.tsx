"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { useActiveSeason, useClosedSeasons, useSeasonStandings } from "@/lib/queries";
import { useAuth } from "@/lib/auth-store";
import { Loader2, Trophy, Medal, Clock, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { SeasonStandingEntry } from "@/lib/queries";

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

function positionLabel(pos: number): string {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return `${pos}º`;
}

function ClosedSeasonStandings({
  seasonId,
  currentUserId,
}: {
  seasonId: string;
  currentUserId?: string;
}) {
  const { data: standings, isLoading } = useSeasonStandings(seasonId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!standings || standings.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-muted-foreground">
        Nenhum participante registrado nesta temporada.
      </p>
    );
  }

  return (
    <div className="space-y-1 pt-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Classificação final
        </p>
        <p className="text-[11px] text-muted-foreground">
          {standings.length} participante{standings.length !== 1 ? "s" : ""}
        </p>
      </div>
      {standings.map((entry: SeasonStandingEntry) => {
        const isMe = entry.id === currentUserId;
        return (
          <div
            key={entry.id}
            className={`flex items-center justify-between rounded-xl px-3 py-2 ${
              isMe
                ? "bg-primary/10 ring-1 ring-primary/20"
                : "bg-muted/40"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-7 shrink-0 text-center text-sm">
                {positionLabel(entry.position)}
              </span>
              <span
                className={`truncate text-sm ${
                  isMe ? "font-semibold text-primary" : "font-medium text-foreground"
                }`}
              >
                {getPlayerName(entry)}
              </span>
              {isMe && (
                <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  você
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                {entry.wins}V {entry.losses}D
              </span>
              <span className={`font-bold tabular-nums ${isMe ? "text-primary" : "text-foreground"}`}>
                {entry.points} pts
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
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
      <div className="mb-3 flex items-center justify-between gap-2">
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
                  <span className="max-w-[160px] truncate">{getPlayerName(entry)}</span>
                </span>
                <span className="text-sm font-bold text-primary">{entry.points} pts</span>
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
  const { user } = useAuth();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <ArenaShell title="Temporadas" subtitle="Hall da Fama" showBack>
      <div className="space-y-6">
        <ActiveSeasonCard />

        <div className="space-y-3">
          <p className="px-1 text-sm font-semibold text-foreground">Hall da Fama</p>

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
              const isFirst = idx === 0;
              const isExpanded = expandedIds.has(season.id);

              return (
                <article
                  key={season.id}
                  className={`rounded-2xl border shadow-sm ${
                    isFirst
                      ? "border-yellow-300 bg-yellow-50"
                      : "border-border bg-card"
                  }`}
                >
                  {/* Cabeçalho — sempre visível */}
                  <div className="flex items-start gap-3 p-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                        isFirst ? "bg-yellow-200" : "bg-muted"
                      }`}
                    >
                      {isFirst ? "🏆" : "🏅"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-bold ${
                            isFirst ? "text-yellow-800" : "text-foreground"
                          }`}
                        >
                          {season.name}
                        </p>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          encerrada
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateRange(season.starts_at, season.ends_at)}
                      </p>
                      {championName ? (
                        <p
                          className={`mt-1 text-sm font-semibold ${
                            isFirst ? "text-yellow-700" : "text-primary"
                          }`}
                        >
                          🥇 {championName}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          Sem campeão registrado
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Botão expandir */}
                  <button
                    onClick={() => toggleExpanded(season.id)}
                    className={`flex w-full items-center justify-center gap-1.5 border-t px-4 py-2.5 text-xs font-semibold transition ${
                      isFirst
                        ? "border-yellow-200 text-yellow-700 hover:bg-yellow-100"
                        : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        Ocultar classificação
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        Ver classificação completa
                      </>
                    )}
                  </button>

                  {/* Standings expandidos */}
                  {isExpanded && (
                    <div
                      className={`border-t px-4 pb-4 ${
                        isFirst ? "border-yellow-200" : "border-border"
                      }`}
                    >
                      <ClosedSeasonStandings
                        seasonId={season.id}
                        currentUserId={user?.id}
                      />
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </ArenaShell>
  );
}
