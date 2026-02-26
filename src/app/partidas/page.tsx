"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import { useState, useMemo } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  usePendingMatches,
  useRecentMatches,
  useMatchCounts,
  useConfirmMatch,
  useContestMatch,
  type MatchWithUsers,
  type UserInfo,
} from "@/lib/queries";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { PendingMatchListSkeleton } from "@/components/skeletons";
import { useAchievementToast } from "@/components/achievement-unlock-toast";

const statusBadge: Record<string, { label: string; className: string }> = {
  pendente: { label: "Aguardando confirmação", className: "bg-amber-100 text-amber-700" },
  edited: { label: "Placar ajustado", className: "bg-orange-100 text-orange-600" },
  validado: { label: "Validado", className: "bg-emerald-100 text-emerald-700" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-600" },
};

const quickOutcomes = ["3x0", "3x1", "3x2", "0x3", "1x3", "2x3"];

export default function PartidasPage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"recentes" | "pendentes">("pendentes");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftOutcome, setDraftOutcome] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewAlertDismissed, setPreviewAlertDismissed] = useState(false);

  // Achievement toast hook
  const { showAchievements } = useAchievementToast();

  // React Query hooks
  const {
    data: pendingData,
    isLoading: pendingLoading,
    error: pendingError,
    refetch: refetchPending,
  } = usePendingMatches(user?.id);
  const {
    data: recentData,
    isLoading: recentLoading,
    error: recentError,
    refetch: refetchRecent,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRecentMatches(user?.id);
  const { data: matchCounts } = useMatchCounts(user?.id);
  const confirmMutation = useConfirmMatch();
  const contestMutation = useContestMatch();
  const previewAlertEnabled = searchParams.get("previewAlert") === "1";
  const visibleActionError =
    actionError ||
    (!previewAlertDismissed && previewAlertEnabled
      ? "Exemplo de erro ao confirmar partida. Tente novamente."
      : null);

  const pendentes = pendingData ?? [];
  const recentes = useMemo(() => {
    return recentData?.pages.flatMap((page) => page.matches) ?? [];
  }, [recentData]);

  const totalPendentes = pendentes.length;
  const totalRecentes = matchCounts?.recentes ?? recentes.length;

  const handleConfirm = (matchId: string) => {
    if (!user) return;
    setActionError(null);
    confirmMutation.mutate(
      { matchId, userId: user.id },
      {
        onSuccess: (result) => {
          // Mostrar toast de conquistas desbloqueadas
          if (result.unlockedAchievements && result.unlockedAchievements.length > 0) {
            showAchievements(result.unlockedAchievements);
          }
        },
        onError: (err) => {
          const message =
            err instanceof Error ? err.message : "Erro ao confirmar partida. Tente novamente.";
          setActionError(message);
          void refetchPending();
          void refetchRecent();
        },
      }
    );
  };

  const handleContest = (matchId: string, newOutcome: string) => {
    if (!user) return;
    setActionError(null);
    contestMutation.mutate(
      { matchId, userId: user.id, newOutcome },
      {
        onSuccess: () => setEditingId(null),
        onError: (err) => {
          const message =
            err instanceof Error ? err.message : "Erro ao contestar partida. Tente novamente.";
          setActionError(message);
          void refetchPending();
          void refetchRecent();
        },
      }
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const getPlayerName = (player: UserInfo) => {
    return player.full_name || player.name || player.email?.split("@")[0] || "Jogador";
  };

  // Loading enquanto auth ou dados carregam
  if (authLoading || pendingLoading || recentLoading) {
    return (
      <AppShell title="Partidas" subtitle="Recentes e Pendentes" showBack>
        <div className="space-y-4">
          {/* Tabs skeleton */}
          <div className="flex gap-3 text-sm font-semibold">
            <button className="rounded-full bg-primary/15 px-3 py-2 text-primary">
              Pendentes
            </button>
            <button className="rounded-full bg-muted/70 px-3 py-2 text-foreground">
              Recentes
            </button>
          </div>
          <PendingMatchListSkeleton count={4} />
        </div>
      </AppShell>
    );
  }

  // Se não está logado
  if (!user) {
    return (
      <AppShell title="Partidas" subtitle="Recentes e Pendentes" showBack>
        <p className="py-8 text-center text-sm text-muted-foreground">
          Faça login para ver suas partidas
        </p>
      </AppShell>
    );
  }

  // Erro
  if (pendingError || recentError) {
    return (
      <AppShell title="Partidas" subtitle="Recentes e Pendentes" showBack>
        <p className="py-8 text-center text-sm text-red-500">
          Erro ao carregar partidas. Tente novamente.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Partidas" subtitle="Recentes e Pendentes" showBack>
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-3 text-sm font-semibold">
          <button
            onClick={() => setActiveTab("pendentes")}
            className={`rounded-full px-3 py-2 transition ${
              activeTab === "pendentes"
                ? "bg-primary/15 text-primary"
                : "bg-muted/70 text-foreground"
            }`}
          >
            Pendentes ({totalPendentes})
          </button>
          <button
            onClick={() => setActiveTab("recentes")}
            className={`rounded-full px-3 py-2 transition ${
              activeTab === "recentes"
                ? "bg-primary/15 text-primary"
                : "bg-muted/70 text-foreground"
            }`}
          >
            Recentes ({totalRecentes})
          </button>
        </div>

        {visibleActionError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <p className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {visibleActionError}
            </p>
            <button
              onClick={() => {
                if (actionError) {
                  setActionError(null);
                } else {
                  setPreviewAlertDismissed(true);
                }
              }}
              className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Lista de partidas */}
        <div className="space-y-3">
          {activeTab === "pendentes" && pendentes.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma partida pendente
            </p>
          )}

          {activeTab === "recentes" && recentes.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma partida recente
            </p>
          )}

          {activeTab === "pendentes" &&
            pendentes.map((match) => (
              <PendingMatchCard
                key={match.id}
                match={match}
                user={user}
                editingId={editingId}
                draftOutcome={draftOutcome}
                loadingMatchId={
                  confirmMutation.isPending || contestMutation.isPending
                    ? (confirmMutation.variables?.matchId || contestMutation.variables?.matchId)
                    : null
                }
                onConfirm={handleConfirm}
                onContest={handleContest}
                onStartEdit={(id, outcome) => {
                  setEditingId(id);
                  setDraftOutcome((prev) => ({ ...prev, [id]: outcome }));
                }}
                onCancelEdit={() => setEditingId(null)}
                onDraftChange={(id, outcome) =>
                  setDraftOutcome((prev) => ({ ...prev, [id]: outcome }))
                }
                getPlayerName={getPlayerName}
                formatDate={formatDate}
              />
            ))}

          {activeTab === "recentes" &&
            recentes.map((match) => (
              <RecentMatchCard
                key={match.id}
                match={match}
                userId={user.id}
                getPlayerName={getPlayerName}
                formatDate={formatDate}
              />
            ))}

          {/* Botao Carregar mais */}
          <LoadMoreButton
            onClick={() => fetchNextPage()}
            isLoading={isFetchingNextPage}
            hasMore={activeTab === "recentes" && !!hasNextPage}
          />
        </div>
      </div>
    </AppShell>
  );
}

// Componente para partida pendente
function PendingMatchCard({
  match,
  user,
  editingId,
  draftOutcome,
  loadingMatchId,
  onConfirm,
  onContest,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  getPlayerName,
  formatDate,
}: {
  match: MatchWithUsers;
  user: { id: string };
  editingId: string | null;
  draftOutcome: Record<string, string>;
  loadingMatchId: string | null | undefined;
  onConfirm: (id: string) => void;
  onContest: (id: string, outcome: string) => void;
  onStartEdit: (id: string, outcome: string) => void;
  onCancelEdit: () => void;
  onDraftChange: (id: string, outcome: string) => void;
  getPlayerName: (p: UserInfo) => string;
  formatDate: (d: string) => string;
}) {
  const badge = statusBadge[match.status] || statusBadge.pendente;
  const isEditing = editingId === match.id;
  const selected = draftOutcome[match.id] ?? `${match.resultado_a}x${match.resultado_b}`;
  const euCriei = match.criado_por === user.id;
  const opponent = match.player_a_id === user.id ? match.player_b : match.player_a;
  const euDevoAgir = match.criado_por !== user.id;
  const isThisLoading = loadingMatchId === match.id;

  return (
    <article className="space-y-3 rounded-2xl border border-border bg-muted/60 p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          vs {getPlayerName(opponent)} • {formatDate(match.created_at)}
        </p>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <p className="text-lg font-bold text-center">
        {match.resultado_a} x {match.resultado_b}
      </p>

      {euCriei && !euDevoAgir ? (
        <p className="text-xs text-muted-foreground text-center">
          Aguardando {getPlayerName(opponent)} confirmar ou contestar.
        </p>
      ) : isEditing ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Ajuste o placar:</p>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
            {quickOutcomes.map((outcome) => (
              <button
                key={outcome}
                onClick={() => onDraftChange(match.id, outcome)}
                className={`rounded-full border px-3 py-2 transition ${
                  selected === outcome
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card text-foreground"
                }`}
              >
                {outcome}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center">
          Confirme o placar ou conteste caso esteja errado.
        </p>
      )}

      {euDevoAgir && (
        <div className="flex gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={() => onConfirm(match.id)}
                disabled={isThisLoading}
                className="flex-1 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:scale-[1.01] disabled:opacity-50"
              >
                {isThisLoading ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Confirmar"
                )}
              </button>
              <button
                onClick={() =>
                  onStartEdit(match.id, `${match.resultado_a}x${match.resultado_b}`)
                }
                className="flex-1 rounded-full border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
              >
                Contestar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onContest(match.id, selected)}
                disabled={isThisLoading}
                className="flex-1 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:scale-[1.01] disabled:opacity-50"
              >
                {isThisLoading ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </button>
              <button
                onClick={onCancelEdit}
                className="flex-1 rounded-full border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

// Componente para partida recente
function RecentMatchCard({
  match,
  userId,
  getPlayerName,
  formatDate,
}: {
  match: MatchWithUsers;
  userId: string;
  getPlayerName: (p: UserInfo) => string;
  formatDate: (d: string) => string;
}) {
  const euSouA = match.player_a_id === userId;
  const euVenci = match.vencedor_id === userId;
  const meusPoints = euSouA ? match.pontos_variacao_a : match.pontos_variacao_b;

  return (
    <article className="space-y-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{formatDate(match.created_at)}</p>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            euVenci ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
          }`}
        >
          {euVenci ? "Vitória" : "Derrota"}
        </span>
      </div>
      <p className="text-sm font-semibold text-foreground">
        {getPlayerName(match.player_a)}{" "}
        <span className="text-primary">
          {match.resultado_a} x {match.resultado_b}
        </span>{" "}
        {getPlayerName(match.player_b)}
      </p>
      {meusPoints && (
        <p className={`text-xs font-semibold ${euVenci ? "text-green-600" : "text-blue-600"}`}>
          +{meusPoints} pts
        </p>
      )}
    </article>
  );
}
