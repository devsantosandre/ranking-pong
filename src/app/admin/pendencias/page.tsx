"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  Filter,
  ListChecks,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  adminGetPendingMatches,
  type AdminAnalyticsPendingMatch,
  type AdminPendingMatchesResponse,
} from "@/app/actions/admin";

type PendingFilter = "all" | "stale" | "pendente" | "edited";

const filterOptions: Array<{ key: PendingFilter; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "stale", label: "Mais de 24h" },
  { key: "pendente", label: "Pendentes" },
  { key: "edited", label: "Contestadas" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDateTime(dateInput: string) {
  return new Date(dateInput).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(dateInput: string) {
  return new Date(`${dateInput}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatPendingAge(ageHours: number) {
  if (ageHours < 24) {
    return `${ageHours}h`;
  }

  const days = Math.floor(ageHours / 24);
  const hours = ageHours % 24;

  if (hours === 0) {
    return `${days}d`;
  }

  return `${days}d ${hours}h`;
}

function SummaryCard({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  tone: string;
}) {
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </article>
  );
}

function PendingMatchRow({ match }: { match: AdminAnalyticsPendingMatch }) {
  const statusLabel = match.status === "edited" ? "Contestada" : "Pendente";
  const statusTone =
    match.status === "edited"
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700";

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${
        match.isStale ? "border-amber-200 bg-amber-50/60" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {match.playersLabel}
            </p>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusTone}`}>
              {statusLabel}
            </span>
            {match.isStale ? (
              <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-700">
                Mais de 24h
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Placar atual {match.scoreLabel}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-foreground">
            {formatPendingAge(match.ageHours)}
          </p>
          <p className="text-[11px] text-muted-foreground">sem resposta</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground">
        <div className="rounded-lg bg-background/80 px-3 py-2">
          Aguardando:{" "}
          <span className="font-semibold text-foreground">{match.waitingForUserName}</span>
        </div>
        <div className="rounded-lg bg-background/80 px-3 py-2">
          Ultima acao:{" "}
          <span className="font-semibold text-foreground">{match.lastActorUserName}</span>
        </div>
        <div className="rounded-lg bg-background/80 px-3 py-2">
          Partida de {formatDateOnly(match.matchDate)}. Registrada em{" "}
          {formatDateTime(match.createdAt)}
        </div>
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted/60" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-44 animate-pulse rounded-2xl bg-muted/60" />
      ))}
    </div>
  );
}

export default function AdminPendenciasPage() {
  const [data, setData] = useState<AdminPendingMatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState<PendingFilter>("all");

  const loadPendingMatches = useCallback(async (preserveData: boolean) => {
    if (preserveData) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await adminGetPendingMatches();
      setData(response);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar pendencias");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPendingMatches(false);
  }, [loadPendingMatches]);

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];

    switch (activeFilter) {
      case "stale":
        return items.filter((item) => item.isStale);
      case "pendente":
        return items.filter((item) => item.status === "pendente");
      case "edited":
        return items.filter((item) => item.status === "edited");
      default:
        return items;
    }
  }, [activeFilter, data]);

  return (
    <AppShell
      title="Pendencias"
      subtitle="Confirmacoes e contestacoes em acompanhamento"
      showBack
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Pendencias do ranking
              </p>
              <p className="text-xs text-muted-foreground">
                Aqui o admin enxerga rapidamente quais jogos ainda esperam resposta e de
                quem e a pendencia agora.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadPendingMatches(data !== null)}
              disabled={loading || refreshing}
              className="w-full"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar pendencias
            </Button>
            <Link
              href="/admin/partidas"
              className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              Abrir gestao de partidas
            </Link>
          </div>
        </section>

        {error ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadPendingMatches(true)}>
              Tentar de novo
            </Button>
          </div>
        ) : null}

        {loading && !data ? (
          <LoadingState />
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard
                title="Abertas"
                value={formatNumber(data.openCount)}
                description="Total de partidas aguardando resposta"
                tone="border-sky-200 bg-sky-50"
              />
              <SummaryCard
                title="Mais de 24h"
                value={formatNumber(data.staleCount)}
                description="Pendencias que precisam de atencao do admin"
                tone="border-amber-200 bg-amber-50"
              />
              <SummaryCard
                title="Pendentes"
                value={formatNumber(data.pendingCount)}
                description="Jogos aguardando primeira confirmacao"
                tone="border-violet-200 bg-violet-50"
              />
              <SummaryCard
                title="Contestadas"
                value={formatNumber(data.editedCount)}
                description="Jogos que voltaram para revisao"
                tone="border-blue-200 bg-blue-50"
              />
            </div>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Filter className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">Filtros rapidos</h2>
                  <p className="text-xs text-muted-foreground">
                    Aguardando mostra quem precisa confirmar ou responder ao placar agora.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {filterOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setActiveFilter(option.key)}
                    className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      activeFilter === option.key
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <ListChecks className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">Jogos aguardando resposta</h2>
                  <p className="text-xs text-muted-foreground">
                    Ordenacao prioriza pendencias antigas e depois os registros mais velhos.
                  </p>
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/15 p-4 text-sm text-muted-foreground">
                  Nenhuma pendencia encontrada para este filtro.
                </div>
              ) : (
                filteredItems.map((match) => <PendingMatchRow key={match.id} match={match} />)
              )}
            </section>
          </>
        ) : null}

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Clock3 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Como acompanhar</h2>
              <p className="text-xs text-muted-foreground">
                Use este painel para saber quem precisa responder e a tela de partidas
                para a gestao completa.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm text-foreground">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              Pendente significa que o adversario ainda nao confirmou o placar enviado.
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              Contestada significa que alguem alterou o placar e a outra pessoa precisa
              responder.
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              Pendencias com mais de 24h merecem acompanhamento porque costumam travar o
              fechamento correto do ranking.
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
