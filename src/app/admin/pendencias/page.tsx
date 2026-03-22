"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
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
  adminCancelMatch,
  adminGetPendingMatches,
  adminValidatePendingMatch,
  type AdminAnalyticsPendingMatch,
  type AdminPendingMatchesResponse,
} from "@/app/actions/admin";

type PendingFilter = "all" | "pendente" | "edited";

function buildFilterOptions(): Array<{ key: PendingFilter; label: string }> {
  return [
    { key: "all", label: "Todas" },
    { key: "pendente", label: "Pendentes" },
    { key: "edited", label: "Contestadas" },
  ];
}

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

function describeTimelineEvent(event: AdminAnalyticsPendingMatch["timeline"][number]) {
  if (event.type === "registered") {
    return `Registrada por ${event.actorName}`;
  }

  return `Placar contestado por ${event.actorName}`;
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

type PendingActionModalState = {
  mode: "accept" | "cancel";
  match: AdminAnalyticsPendingMatch;
};

function PendingActionModal({
  state,
  reason,
  fieldError,
  actionError,
  loading,
  onClose,
  onConfirm,
  onReasonChange,
}: {
  state: PendingActionModalState | null;
  reason: string;
  fieldError: string;
  actionError: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  onReasonChange: (value: string) => void;
}) {
  if (!state) return null;

  const isCancel = state.mode === "cancel";
  const title = isCancel ? "Cancelar partida" : "Aceitar partida";
  const confirmText = isCancel ? "Cancelar partida" : "Aceitar partida";
  const playerAWon = state.match.scoreA > state.match.scoreB;
  const playerBWon = state.match.scoreB > state.match.scoreA;
  const resultSummary = playerAWon
    ? `Placar informado: ${state.match.playerAName} venceu`
    : playerBWon
      ? `Placar informado: ${state.match.playerBName} venceu`
      : "Placar informado";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-xl">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{state.match.playersLabel}</p>
        </div>

        <div className="mt-4 space-y-2 rounded-2xl border border-border/70 bg-card/80 p-3">
          <p
            className={`text-xs font-semibold ${
              playerAWon || playerBWon ? "text-emerald-700" : "text-foreground"
            }`}
          >
            {resultSummary}
          </p>

          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <div
              className={`rounded-lg border px-2 py-2 ${
                playerAWon
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-border bg-background text-foreground"
              }`}
            >
              <p className="truncate text-[11px] font-semibold text-muted-foreground">
                {state.match.playerAName}
              </p>
              <p className="text-2xl font-bold leading-none tabular-nums">
                {state.match.scoreA}
              </p>
            </div>

            <span className="text-lg font-semibold text-muted-foreground">x</span>

            <div
              className={`rounded-lg border px-2 py-2 text-right ${
                playerBWon
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-border bg-background text-foreground"
              }`}
            >
              <p className="truncate text-[11px] font-semibold text-muted-foreground">
                {state.match.playerBName}
              </p>
              <p className="text-2xl font-bold leading-none tabular-nums">
                {state.match.scoreB}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border/70 bg-muted/15 p-3 text-sm text-foreground">
          {isCancel ? (
            <p>
              Esta ação cancela a partida diretamente por aqui. Como ela ainda não foi
              validada, não há pontos para reverter.
            </p>
          ) : (
            <p>
              Esta ação valida a partida pelo admin, aplica os pontos do placar atual e
              encerra a pendência antes da confirmação automática.
            </p>
          )}
        </div>

        {isCancel ? (
          <div className="mt-4 space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Motivo do cancelamento
            </label>
            <textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Explique por que a partida está sendo cancelada"
              rows={3}
              className={`w-full rounded-2xl border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none ${
                fieldError ? "border-red-500 focus:border-red-500" : "border-border focus:border-primary"
              }`}
            />
            {fieldError ? <p className="text-xs text-red-600">{fieldError}</p> : null}
          </div>
        ) : null}

        {actionError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}

        <div className="mt-5 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Voltar
          </Button>
          <Button
            type="button"
            className={`flex-1 ${isCancel ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
            onClick={() => void onConfirm()}
            disabled={loading}
          >
            {loading ? "Aguarde..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PendingMatchRow({
  match,
  loading,
  onAccept,
  onCancel,
}: {
  match: AdminAnalyticsPendingMatch;
  loading: boolean;
  onAccept: (match: AdminAnalyticsPendingMatch) => void;
  onCancel: (match: AdminAnalyticsPendingMatch) => void;
}) {
  const statusLabel = match.status === "edited" ? "Contestada" : "Pendente";
  const statusTone =
    match.status === "edited"
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700";
  const playerAWon = match.scoreA > match.scoreB;
  const playerBWon = match.scoreB > match.scoreA;
  const hasTimelineHistory = match.timeline.length > 1;
  const hasPendingStateChange = match.pendingSinceAt !== match.createdAt;
  const resultSummary = playerAWon
    ? `Placar informado: ${match.playerAName} venceu`
    : playerBWon
      ? `Placar informado: ${match.playerBName} venceu`
      : "Placar informado";

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-foreground">
            {match.playersLabel}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusTone}`}>
              {statusLabel}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-foreground">
            {formatPendingAge(match.ageHours)}
          </p>
          <p className="text-[11px] text-muted-foreground">sem resposta</p>
        </div>
      </div>

      <div className="mt-3 space-y-2 rounded-xl border border-border/70 bg-card/80 p-3">
        <p
          className={`text-xs font-semibold ${
            playerAWon || playerBWon ? "text-emerald-700" : "text-foreground"
          }`}
        >
          {resultSummary}
        </p>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <div
            className={`rounded-lg border px-2 py-2 ${
              playerAWon
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-border bg-background text-foreground"
            }`}
          >
            <p className="truncate text-[11px] font-semibold text-muted-foreground">
              {match.playerAName}
            </p>
            <p className="text-2xl font-bold leading-none tabular-nums">
              {match.scoreA}
            </p>
          </div>

          <span className="text-lg font-semibold text-muted-foreground">x</span>

          <div
            className={`rounded-lg border px-2 py-2 text-right ${
              playerBWon
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-border bg-background text-foreground"
            }`}
          >
            <p className="truncate text-[11px] font-semibold text-muted-foreground">
              {match.playerBName}
            </p>
            <p className="text-2xl font-bold leading-none tabular-nums">
              {match.scoreB}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground">
        <div className="rounded-lg bg-background/80 px-3 py-2">
          Responsável agora:{" "}
          <span className="font-semibold text-foreground">{match.waitingForUserName}</span>
        </div>
        <div className="rounded-lg bg-background/80 px-3 py-2">
          Confirma automaticamente em{" "}
          <span className="font-semibold text-foreground">
            {formatDateTime(match.deadlineAt)}
          </span>
        </div>
        {hasPendingStateChange ? (
          <div className="rounded-lg bg-background/80 px-3 py-2">
            Pendência atual desde{" "}
            <span className="font-semibold text-foreground">
              {formatDateTime(match.pendingSinceAt)}
            </span>
          </div>
        ) : null}
        <div className="rounded-lg bg-background/80 px-3 py-2">
          Partida de {formatDateOnly(match.matchDate)}. Registrada em{" "}
          {formatDateTime(match.createdAt)}
        </div>
      </div>

      {hasTimelineHistory ? (
        <div className="mt-3 rounded-lg bg-background/80 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Histórico da pendência
          </p>
          <div className="mt-2 space-y-2">
            {[...match.timeline].reverse().map((event) => (
              <div key={event.id} className="flex items-start justify-between gap-3 text-[11px]">
                <p className="text-foreground">{describeTimelineEvent(event)}</p>
                <span className="shrink-0 text-muted-foreground">
                  {formatDateTime(event.occurredAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
        <Button
          type="button"
          size="sm"
          className="rounded-full px-4 whitespace-nowrap"
          onClick={() => onAccept(match)}
          disabled={loading}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Aceitar
        </Button>
        <button
          type="button"
          className="text-sm font-semibold text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onCancel(match)}
          disabled={loading}
        >
          Cancelar
        </button>
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
  const [actionState, setActionState] = useState<PendingActionModalState | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const deadlineHours = data?.deadlineHours ?? 6;
  const filterOptions = useMemo(() => buildFilterOptions(), []);

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
      setError(err instanceof Error ? err.message : "Erro ao carregar pendências");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPendingMatches(false);
  }, [loadPendingMatches]);

  const resetActionModal = useCallback(() => {
    setActionState(null);
    setActionReason("");
    setFieldError("");
    setActionError("");
    setActionLoading(false);
  }, []);

  const handleReasonChange = useCallback((value: string) => {
    setActionReason(value);
    if (!value.trim()) {
      setFieldError("Motivo do cancelamento é obrigatório.");
      return;
    }
    if (value.trim().length < 5) {
      setFieldError("Motivo deve ter pelo menos 5 caracteres.");
      return;
    }
    setFieldError("");
  }, []);

  const handleOpenAccept = useCallback((match: AdminAnalyticsPendingMatch) => {
    setActionState({ mode: "accept", match });
    setActionReason("");
    setFieldError("");
    setActionError("");
  }, []);

  const handleOpenCancel = useCallback((match: AdminAnalyticsPendingMatch) => {
    setActionState({ mode: "cancel", match });
    setActionReason("");
    setFieldError("");
    setActionError("");
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!actionState) return;

    if (actionState.mode === "cancel") {
      if (!actionReason.trim()) {
        setFieldError("Motivo do cancelamento é obrigatório.");
        return;
      }
      if (actionReason.trim().length < 5) {
        setFieldError("Motivo deve ter pelo menos 5 caracteres.");
        return;
      }
    }

    setActionLoading(true);
    setActionError("");

    try {
      if (actionState.mode === "accept") {
        await adminValidatePendingMatch(actionState.match.id, "pendencias");
      } else {
        await adminCancelMatch(actionState.match.id, actionReason.trim(), "pendencias");
      }

      await loadPendingMatches(true);
      resetActionModal();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao concluir ação");
      setActionLoading(false);
    }
  }, [actionReason, actionState, loadPendingMatches, resetActionModal]);

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];

    switch (activeFilter) {
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
      title="Pendências"
      subtitle="Confirmações e contestações antes da validação automática"
      showBack
    >
      <div className="space-y-4">
        <PendingActionModal
          state={actionState}
          reason={actionReason}
          fieldError={fieldError}
          actionError={actionError}
          loading={actionLoading}
          onClose={resetActionModal}
          onConfirm={handleConfirmAction}
          onReasonChange={handleReasonChange}
        />

        <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Pendências do ranking
              </p>
              <p className="text-xs text-muted-foreground">
                Aqui o admin enxerga rapidamente quais jogos ainda esperam resposta, de
                quem é a pendência agora e pode resolver os casos antes da confirmação automática.
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
              Atualizar pendências
            </Button>
            <Link
              href="/admin/partidas"
              className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              Abrir gestão de partidas
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
                title="Confirmação automática"
                value={`${deadlineHours}h`}
                description="Prazo atual antes da validação automática"
                tone="border-cyan-200 bg-cyan-50"
              />
              <SummaryCard
                title="Pendentes"
                value={formatNumber(data.pendingCount)}
                description="Jogos aguardando primeira confirmação"
                tone="border-violet-200 bg-violet-50"
              />
              <SummaryCard
                title="Contestadas"
                value={formatNumber(data.editedCount)}
                description="Jogos que voltaram para revisão"
                tone="border-blue-200 bg-blue-50"
              />
            </div>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Filter className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">Filtros rápidos</h2>
                  <p className="text-xs text-muted-foreground">
                    O prazo configurado hoje é de {deadlineHours}h para confirmar ou contestar antes da validação automática pelo sistema.
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
                    A lista mostra só os jogos ainda abertos, do mais antigo para o mais recente.
                  </p>
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/15 p-4 text-sm text-muted-foreground">
                  Nenhuma pendência encontrada para este filtro.
                </div>
              ) : (
                filteredItems.map((match) => (
                  <PendingMatchRow
                    key={match.id}
                    match={match}
                    loading={actionLoading && actionState?.match.id === match.id}
                    onAccept={handleOpenAccept}
                    onCancel={handleOpenCancel}
                  />
                ))
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
                    Use este painel para acompanhar os jogos em aberto e agir antes que o sistema confirme automaticamente.
                  </p>
                </div>
              </div>
          <div className="mt-4 space-y-3 text-sm text-foreground">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              Pendente significa que o adversário ainda não confirmou o placar enviado.
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              Contestada significa que alguém alterou o placar e a outra pessoa precisa
              responder.
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              Depois de {deadlineHours}h sem resposta, o sistema confirma automaticamente o placar atual.
              O admin pode aceitar ou cancelar manualmente antes disso.
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
