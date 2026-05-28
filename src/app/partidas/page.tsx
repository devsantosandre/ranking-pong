"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import { useState, useMemo, useRef, useEffect } from "react";
import { AlertCircle, CheckCircle, Clock3, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  usePendingDashboard,
  useRecentMatches,
  useConfirmMatch,
  useContestMatch,
  useConfirmMatchDidHappen,
  useReportMatchDidNotHappen,
  type MatchWithUsers,
  type UserInfo,
} from "@/lib/queries";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { PendingMatchListSkeleton } from "@/components/skeletons";
import { useAchievementToast } from "@/components/achievement-unlock-toast";

const statusBadge: Record<string, { label: string; className: string }> = {
  pendente: { label: "Aguardando confirmação", className: "bg-amber-100 text-amber-700" },
  edited: { label: "Placar ajustado", className: "bg-orange-100 text-orange-600" },
  validado: { label: "Validado", className: "bg-emerald-100 text-emerald-700" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-600" },
};

function getRecentMatchBadge(match: MatchWithUsers, euVenci: boolean) {
  if (match.status === "cancelado") {
    return {
      label: match.cancellation_reason === "nonexistent" ? "Jogo inexistente" : "Cancelado",
      className:
        match.cancellation_reason === "nonexistent"
          ? "bg-red-100 text-red-700"
          : "bg-muted text-muted-foreground",
    };
  }

  if (match.status === "validado" && match.aprovado_por === null) {
    return {
      label: "Validado pelo sistema",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  return {
    label: euVenci ? "Vitória" : "Derrota",
    className: euVenci ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600",
  };
}

function getCancellationMessage(match: MatchWithUsers) {
  if (match.status !== "cancelado") return null;

  if (match.cancellation_reason === "nonexistent") {
    if (match.cancellation_actor === "system") {
      return "Cancelada automaticamente porque o prazo expirou após a solicitação de jogo inexistente.";
    }

    return "Cancelada após os jogadores confirmarem que o jogo não existiu.";
  }

  return "Esta partida foi cancelada e não alterou o ranking.";
}

const quickOutcomes = ["3x0", "3x1", "3x2", "0x3", "1x3", "2x3"];

type PendingMatchLoadingAction =
  | "confirm"
  | "contest"
  | "confirmDidHappen"
  | "reportDidNotHappen"
  | null;

function parseOutcome(outcome: string): { left: number; right: number } | null {
  const match = outcome.match(/^(\d{1,2})x(\d{1,2})$/);
  if (!match) return null;

  const left = Number(match[1]);
  const right = Number(match[2]);

  if (Number.isNaN(left) || Number.isNaN(right)) return null;
  return { left, right };
}

function toUserOutcome(matchOutcome: string, isUserPlayerA: boolean): string {
  const parsed = parseOutcome(matchOutcome);
  if (!parsed) return matchOutcome;
  return isUserPlayerA
    ? `${parsed.left}x${parsed.right}`
    : `${parsed.right}x${parsed.left}`;
}

function toMatchOutcome(userOutcome: string, isUserPlayerA: boolean): string {
  const parsed = parseOutcome(userOutcome);
  if (!parsed) return userOutcome;
  return isUserPlayerA
    ? `${parsed.left}x${parsed.right}`
    : `${parsed.right}x${parsed.left}`;
}

function formatDeadlineDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDeadlineHighlight(deadlineAt: string | null) {
  if (!deadlineAt) {
    return {
      containerClassName: "border-border/70 bg-muted/20 text-muted-foreground",
      iconClassName: "text-muted-foreground",
      label: null,
    };
  }

  const remainingMs = new Date(deadlineAt).getTime() - Date.now();

  if (remainingMs <= 0) {
    return {
      containerClassName: "border-red-200 bg-red-50 text-red-700",
      iconClassName: "text-red-600",
      label: "Prazo encerrado",
    };
  }

  if (remainingMs <= 60 * 60 * 1000) {
    return {
      containerClassName: "border-amber-200 bg-amber-50 text-amber-800",
      iconClassName: "text-amber-700",
      label: "Menos de 1h restante",
    };
  }

  if (remainingMs <= 3 * 60 * 60 * 1000) {
    return {
      containerClassName: "border-orange-200 bg-orange-50 text-orange-800",
      iconClassName: "text-orange-700",
      label: "Prazo se aproximando",
    };
  }

  return {
    containerClassName: "border-primary/20 bg-primary/5 text-primary",
    iconClassName: "text-primary",
    label: "Dentro do prazo",
  };
}

export default function PartidasPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"recentes" | "pendentes">("pendentes");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftOutcome, setDraftOutcome] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewAlertDismissed, setPreviewAlertDismissed] = useState(false);
  const [reportDidNotHappenModal, setReportDidNotHappenModal] = useState({
    isOpen: false,
    matchId: "",
  });
  const [reportDidNotHappenError, setReportDidNotHappenError] = useState<string | null>(null);
  const [confirmFeedback, setConfirmFeedback] = useState<string | null>(null);
  const confirmFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [registrationBannerDismissed, setRegistrationBannerDismissed] = useState(false);

  // Achievement toast hook
  const { showAchievements } = useAchievementToast();

  // React Query hooks — usePendingDashboard substitui 3 chamadas separadas:
  //   usePendingMatches + useMatchCounts + usePendingConfirmationStatus
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchPending,
  } = usePendingDashboard(user?.id);
  const {
    data: recentData,
    isLoading: recentLoading,
    error: recentError,
    refetch: refetchRecent,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRecentMatches(user?.id);
  const confirmMutation = useConfirmMatch();
  const contestMutation = useContestMatch();
  const confirmDidHappenMutation = useConfirmMatchDidHappen();
  const reportDidNotHappenMutation = useReportMatchDidNotHappen();
  const [registeredOpponent] = useState<string | null>(() =>
    searchParams.get("registered") === "1"
      ? decodeURIComponent(searchParams.get("opponent") ?? "")
      : null
  );
  const [registeredOpponentId] = useState<string | null>(() =>
    searchParams.get("registered") === "1"
      ? decodeURIComponent(searchParams.get("opponentId") ?? "")
      : null
  );
  const showRegistrationBanner = !!registeredOpponent && !registrationBannerDismissed;

  useEffect(() => {
    if (registeredOpponent) {
      router.replace("/partidas");
    }
    return () => {
      if (confirmFeedbackTimerRef.current) clearTimeout(confirmFeedbackTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewAlertEnabled = searchParams.get("previewAlert") === "1";
  const visibleActionError =
    actionError ||
    (!previewAlertDismissed && previewAlertEnabled
      ? "Exemplo de erro ao confirmar partida. Tente novamente."
      : null);

  const pendentes = dashboardData?.pendingMatches ?? [];
  const recentes = useMemo(() => {
    return recentData?.pages.flatMap((page) => page.matches) ?? [];
  }, [recentData]);

  const highlightedMatchId = useMemo(() => {
    if (!showRegistrationBanner || !registeredOpponentId) return null;
    const candidates = pendentes.filter(
      (m) => m.player_a_id === registeredOpponentId || m.player_b_id === registeredOpponentId
    );
    if (candidates.length === 0) return null;
    const newest = candidates.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    // Só destaca se a partida foi criada nos últimos 5 minutos — garante que é a recém-registrada
    const ageMs = Date.now() - new Date(newest.created_at).getTime();
    if (ageMs > 2 * 60 * 1000) return null;
    return newest.id;
  }, [showRegistrationBanner, registeredOpponentId, pendentes]);

  const totalPendentes = pendentes.length;
  const totalRecentes = dashboardData?.recentCount ?? recentes.length;
  const deadlineHours = dashboardData?.deadlineHours ?? 6;
  const loadingMatchId =
    confirmMutation.isPending
      ? confirmMutation.variables?.matchId
      : contestMutation.isPending
        ? contestMutation.variables?.matchId
        : confirmDidHappenMutation.isPending
          ? confirmDidHappenMutation.variables?.matchId
          : reportDidNotHappenMutation.isPending
            ? reportDidNotHappenMutation.variables?.matchId
            : null;
  const loadingAction: PendingMatchLoadingAction =
    confirmMutation.isPending
      ? "confirm"
      : contestMutation.isPending
        ? "contest"
        : confirmDidHappenMutation.isPending
          ? "confirmDidHappen"
          : reportDidNotHappenMutation.isPending
            ? "reportDidNotHappen"
            : null;

  const showFeedback = (message: string) => {
    if (confirmFeedbackTimerRef.current) clearTimeout(confirmFeedbackTimerRef.current);
    setConfirmFeedback(message);
    confirmFeedbackTimerRef.current = setTimeout(() => setConfirmFeedback(null), 5000);
  };

  const handleConfirm = (matchId: string) => {
    if (!user) return;
    setActionError(null);
    const isCancelingNonexistent =
      pendentes.find((m) => m.id === matchId)?.pending_kind === "nonexistent";
    confirmMutation.mutate(
      { matchId, userId: user.id },
      {
        onSuccess: (result) => {
          if (result.unlockedAchievements && result.unlockedAchievements.length > 0) {
            showAchievements(result.unlockedAchievements);
          }
          showFeedback(
            isCancelingNonexistent
              ? "Partida cancelada! Foi para o seu histórico."
              : "Partida confirmada! Foi para o seu histórico."
          );
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
        onSuccess: () => {
          setEditingId(null);
          showFeedback("Placar contestado! Aguardando o adversário responder.");
        },
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

  const handleReportDidNotHappen = (matchId: string) => {
    if (!user) return;

    setActionError(null);
    setReportDidNotHappenError(null);
    setReportDidNotHappenModal({ isOpen: true, matchId });
  };

  const handleConfirmDidHappen = (matchId: string) => {
    if (!user) return;

    setActionError(null);
    confirmDidHappenMutation.mutate(
      { matchId, userId: user.id },
      {
        onSuccess: () => {
          showFeedback("Confirmado! O jogo existiu. Agora confirme ou conteste o placar.");
        },
        onError: (err) => {
          const message =
            err instanceof Error
              ? err.message
              : "Erro ao informar que o jogo existiu. Tente novamente.";
          setActionError(message);
          void refetchPending();
          void refetchRecent();
        },
      }
    );
  };

  const handleConfirmReportDidNotHappen = async () => {
    if (!user || !reportDidNotHappenModal.matchId) return false;

    setActionError(null);
    setReportDidNotHappenError(null);

    try {
      await reportDidNotHappenMutation.mutateAsync({
        matchId: reportDidNotHappenModal.matchId,
        userId: user.id,
      });
      showFeedback("Solicitação enviada! Aguardando o adversário confirmar o cancelamento.");
      return true;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro ao marcar jogo como inexistente. Tente novamente.";
      setReportDidNotHappenError(message);
      void refetchPending();
      void refetchRecent();
      return false;
    }
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
  if (authLoading || dashboardLoading || recentLoading) {
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
  if (dashboardError || recentError) {
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

        {showRegistrationBanner && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            <p className="flex items-start gap-2 font-medium">
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Partida registrada! Aguardando{" "}
                <span className="font-semibold">{registeredOpponent}</span> confirmar.
              </span>
            </p>
            <button
              onClick={() => setRegistrationBannerDismissed(true)}
              className="shrink-0 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              OK
            </button>
          </div>
        )}

        {confirmFeedback && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {confirmFeedback}
            </p>
            <button
              onClick={() => {
                if (confirmFeedbackTimerRef.current)
                  clearTimeout(confirmFeedbackTimerRef.current);
                setConfirmFeedback(null);
              }}
              className="shrink-0 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              OK
            </button>
          </div>
        )}

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
                loadingMatchId={loadingMatchId}
                loadingAction={loadingAction}
                highlighted={match.id === highlightedMatchId}
                onConfirm={handleConfirm}
                onContest={handleContest}
                onConfirmDidHappen={handleConfirmDidHappen}
                onReportDidNotHappen={handleReportDidNotHappen}
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

      <ConfirmModal
        isOpen={reportDidNotHappenModal.isOpen}
        onClose={() => {
          setReportDidNotHappenModal({ isOpen: false, matchId: "" });
          setReportDidNotHappenError(null);
        }}
        onConfirm={handleConfirmReportDidNotHappen}
        title="Confirmar jogo inexistente"
        description="Enviar para o adversário confirmar que este jogo não existiu?"
        confirmText="Confirmar envio"
        cancelText="Voltar"
        variant="warning"
        loading={reportDidNotHappenMutation.isPending}
        errorMessage={reportDidNotHappenError ?? undefined}
      />
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
  loadingAction,
  highlighted = false,
  onConfirm,
  onContest,
  onConfirmDidHappen,
  onReportDidNotHappen,
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
  loadingAction: PendingMatchLoadingAction;
  highlighted?: boolean;
  onConfirm: (id: string) => void;
  onContest: (id: string, outcome: string) => void;
  onConfirmDidHappen: (id: string) => void;
  onReportDidNotHappen: (id: string) => void;
  onStartEdit: (id: string, outcome: string) => void;
  onCancelEdit: () => void;
  onDraftChange: (id: string, outcome: string) => void;
  getPlayerName: (p: UserInfo) => string;
  formatDate: (d: string) => string;
}) {
  const badge = statusBadge[match.status] || statusBadge.pendente;
  const isEditing = editingId === match.id;
  const euCriei = match.criado_por === user.id;
  const opponent = match.player_a_id === user.id ? match.player_b : match.player_a;
  const opponentName = getPlayerName(opponent);
  const euDevoAgir = match.criado_por !== user.id;
  const isThisLoading = loadingMatchId === match.id;
  const meIsPlayerA = match.player_a_id === user.id;
  const currentMatchOutcome = `${match.resultado_a}x${match.resultado_b}`;
  const currentUserOutcome = toUserOutcome(currentMatchOutcome, meIsPlayerA);
  const selectedUserOutcome = draftOutcome[match.id] ?? currentUserOutcome;
  const selectedMatchOutcome = toMatchOutcome(selectedUserOutcome, meIsPlayerA);
  const selectedUserScore = parseOutcome(selectedUserOutcome);
  const defaultMyScore = meIsPlayerA ? match.resultado_a : match.resultado_b;
  const defaultOpponentScore = meIsPlayerA ? match.resultado_b : match.resultado_a;
  const myScore = isEditing && selectedUserScore ? selectedUserScore.left : defaultMyScore;
  const opponentScore =
    isEditing && selectedUserScore ? selectedUserScore.right : defaultOpponentScore;
  const iWon = myScore > opponentScore;
  const opponentWon = opponentScore > myScore;
  const isNonexistentPending = match.pending_kind === "nonexistent";
  const isNonexistentRejected = match.pending_context === "nonexistent_rejected";
  const iRejectedNonexistent = isNonexistentRejected && match.pending_context_actor_id === user.id;
  const resultSummaryPrefix = isEditing ? "Novo placar:" : "Placar informado:";
  const resultSummary = iWon
    ? `${resultSummaryPrefix} você venceu`
    : opponentWon
      ? `${resultSummaryPrefix} adversário venceu`
      : `${resultSummaryPrefix} empate`;
  const mobileBadgeLabel = badge.label === "Aguardando confirmação" ? "Aguardando" : badge.label;
  const deadlineLabel = match.confirmation_deadline_at
    ? formatDeadlineDateTime(match.confirmation_deadline_at)
    : null;
  const deadlineActionLabel = isNonexistentPending
    ? "Cancela automaticamente em"
    : "Confirma automaticamente em";
  const deadlineHighlight = getDeadlineHighlight(match.confirmation_deadline_at ?? null);
  const isConfirmLoading = isThisLoading && loadingAction === "confirm";
  const isContestLoading = isThisLoading && loadingAction === "contest";
  const isConfirmDidHappenLoading = isThisLoading && loadingAction === "confirmDidHappen";
  const isReportDidNotHappenLoading = isThisLoading && loadingAction === "reportDidNotHappen";
  const actionsGridClassName =
    !isEditing && isNonexistentPending
      ? "grid gap-2 min-[480px]:grid-cols-2"
      : "grid gap-2 sm:grid-cols-3";

  return (
    <article
      className={`space-y-3 rounded-2xl border p-3 transition-all duration-500 ${
        highlighted
          ? "border-primary/60 bg-primary/10 animate-glow-pulse"
          : "border-border bg-muted/60 shadow-sm"
      }`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p
            title={`vs ${opponentName}`}
            className="break-words text-sm font-semibold leading-tight text-foreground"
          >
            vs {opponentName}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(match.created_at)}</p>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${badge.className}`}
        >
          <span className="sm:hidden">{mobileBadgeLabel}</span>
          <span className="hidden sm:inline">{badge.label}</span>
        </span>
      </div>

      <div className="space-y-2 rounded-xl border border-border/70 bg-card/80 p-3">
        <p
          className={`text-xs font-semibold ${
            iWon ? "text-emerald-700" : opponentWon ? "text-amber-700" : "text-foreground"
          }`}
        >
          {resultSummary}
        </p>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <div
            className={`rounded-lg border px-2 py-2 ${
              iWon
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-border bg-background text-foreground"
            }`}
          >
            <p className="truncate text-[11px] font-semibold text-muted-foreground">
              Você
            </p>
            <p className="text-2xl font-bold leading-none tabular-nums">{myScore}</p>
          </div>

          <span className="text-lg font-semibold text-muted-foreground">x</span>

          <div
            className={`rounded-lg border px-2 py-2 text-right ${
              opponentWon
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-border bg-background text-foreground"
            }`}
          >
            <p className="truncate text-[11px] font-semibold text-muted-foreground">
              Adversário
            </p>
            <p className="text-2xl font-bold leading-none tabular-nums">{opponentScore}</p>
          </div>
        </div>
      </div>

      {euCriei && !euDevoAgir ? (
        <div className="space-y-1 text-center">
          <p className="text-xs text-muted-foreground">
            {isNonexistentRejected && iRejectedNonexistent
              ? "Você informou que este jogo existiu. Aguardando o adversário confirmar ou contestar o placar."
              : isNonexistentPending
              ? "Aguardando o adversário confirmar que este jogo não existiu."
              : "Aguardando o adversário confirmar ou contestar."}
          </p>
          {deadlineLabel ? (
            <div
              className={`inline-flex flex-col items-center gap-1 rounded-xl border px-3 py-2 ${deadlineHighlight.containerClassName}`}
            >
              <div className="flex items-center gap-1.5">
                <Clock3 className={`h-3.5 w-3.5 ${deadlineHighlight.iconClassName}`} />
                <p className="text-xs font-semibold">
                  {deadlineActionLabel} {deadlineLabel}
                </p>
              </div>
              {deadlineHighlight.label ? (
                <p className="text-[11px] font-medium">{deadlineHighlight.label}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : isEditing ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Ajuste o placar (Você x Adversário):</p>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
            {quickOutcomes.map((outcome) => (
              <button
                key={outcome}
                onClick={() => onDraftChange(match.id, outcome)}
                className={`rounded-full border px-3 py-2 transition ${
                  selectedUserOutcome === outcome
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
        <div className="space-y-1 text-center">
          <p className="text-xs text-muted-foreground">
            {isNonexistentPending
              ? "O adversário informou que este jogo não existiu. Confirme para cancelar a partida."
              : isNonexistentRejected
                ? iRejectedNonexistent
                  ? "Você informou que este jogo existiu. Confirme o placar ajustado ou conteste se ainda estiver errado."
                  : "O adversário informou que este jogo existiu. Confirme o placar ou conteste alterando o resultado."
              : "Confirme o placar ou conteste caso esteja errado."}
          </p>
          {deadlineLabel ? (
            <div
              className={`inline-flex flex-col items-center gap-1 rounded-xl border px-3 py-2 ${deadlineHighlight.containerClassName}`}
            >
              <div className="flex items-center gap-1.5">
                <Clock3 className={`h-3.5 w-3.5 ${deadlineHighlight.iconClassName}`} />
                <p className="text-xs font-semibold">
                  {deadlineActionLabel} {deadlineLabel}
                </p>
              </div>
              {deadlineHighlight.label ? (
                <p className="text-[11px] font-medium">{deadlineHighlight.label}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {euDevoAgir && (
        <div className={actionsGridClassName}>
          {!isEditing ? (
            isNonexistentPending ? (
              <>
                <button
                  onClick={() => onConfirmDidHappen(match.id)}
                  disabled={isThisLoading}
                  className="min-h-11 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:scale-[1.01] disabled:opacity-50"
                >
                  {isConfirmDidHappenLoading ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    "O jogo existiu"
                  )}
                </button>
                <button
                  onClick={() => onConfirm(match.id)}
                  disabled={isThisLoading}
                  aria-label="Confirmar cancelamento"
                  className="min-h-11 whitespace-nowrap rounded-full border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                >
                  {isConfirmLoading ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    "Cancelar partida"
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onConfirm(match.id)}
                  disabled={isThisLoading}
                  className="rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:scale-[1.01] disabled:opacity-50"
                >
                  {isConfirmLoading ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    "Confirmar"
                  )}
                </button>
                <button
                  onClick={() =>
                    onStartEdit(match.id, currentUserOutcome)
                  }
                  className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
                >
                  Contestar
                </button>
                <button
                  onClick={() => onReportDidNotHappen(match.id)}
                  disabled={isThisLoading || isNonexistentRejected}
                  title={
                    isNonexistentRejected
                      ? iRejectedNonexistent
                        ? "Você já informou que este jogo existiu. Confirme ou conteste o placar."
                        : "O adversário já informou que este jogo existiu. Confirme ou conteste o placar."
                      : undefined
                  }
                  className="rounded-full border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                >
                  {isReportDidNotHappenLoading ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    "Jogo não existiu"
                  )}
                </button>
                {isNonexistentRejected ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800 sm:col-span-3">
                    {iRejectedNonexistent
                      ? "Você já respondeu que o jogo existiu. Para encerrar a pendência, confirme o placar ou conteste informando o resultado correto."
                      : "O adversário já respondeu que o jogo existiu. Para encerrar a pendência, confirme o placar ou conteste informando o resultado correto."}
                  </p>
                ) : null}
              </>
            )
          ) : (
            <>
              <button
                onClick={() => onContest(match.id, selectedMatchOutcome)}
                disabled={isThisLoading}
                className="rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:scale-[1.01] disabled:opacity-50 sm:col-span-2"
              >
                {isContestLoading ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </button>
              <button
                onClick={onCancelEdit}
                className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
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
  const isCancelled = match.status === "cancelado";
  const badge = getRecentMatchBadge(match, euVenci);
  const meusPoints = euSouA ? match.pontos_variacao_a : match.pontos_variacao_b;
  const opponent = euSouA ? match.player_b : match.player_a;
  const opponentName = getPlayerName(opponent);
  const myScore = euSouA ? match.resultado_a : match.resultado_b;
  const opponentScore = euSouA ? match.resultado_b : match.resultado_a;
  const cancellationMessage = getCancellationMessage(match);
  const pointsLabel =
    typeof meusPoints === "number" ? `${meusPoints > 0 ? "+" : ""}${meusPoints} pts` : null;
  const pointsClassName =
    typeof meusPoints === "number"
      ? meusPoints >= 0
        ? "text-green-600"
        : "text-red-600"
      : "";
  const resultSummary = isCancelled
    ? match.cancellation_reason === "nonexistent"
      ? "Partida cancelada porque o jogo não existiu"
      : "Partida cancelada"
    : euVenci
      ? "Você venceu esta partida"
      : "Você perdeu esta partida";

  return (
    <article className="space-y-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p
            title={`vs ${opponentName}`}
            className="break-words text-sm font-semibold leading-tight text-foreground"
          >
            vs {opponentName}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(match.created_at)}</p>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="space-y-2 rounded-xl border border-border/70 bg-muted/30 p-3">
        <p className="text-xs font-semibold text-foreground">{resultSummary}</p>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <div
            className={`rounded-lg border px-2 py-2 ${
              !isCancelled && euVenci
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-border bg-background text-foreground"
            }`}
          >
            <p className="truncate text-[11px] font-semibold text-muted-foreground">Você</p>
            <p className="text-2xl font-bold leading-none tabular-nums">{myScore}</p>
          </div>

          <span className="text-lg font-semibold text-muted-foreground">x</span>

          <div
            className={`rounded-lg border px-2 py-2 text-right ${
              !isCancelled && !euVenci
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-border bg-background text-foreground"
            }`}
          >
            <p className="truncate text-[11px] font-semibold text-muted-foreground">
              Adversário
            </p>
            <p className="text-2xl font-bold leading-none tabular-nums">{opponentScore}</p>
          </div>
        </div>
      </div>

      {match.status === "validado" && match.aprovado_por === null ? (
        <p className="text-xs font-medium text-emerald-700">
          Esta partida foi validada automaticamente pelo sistema após o prazo de
          resposta.
        </p>
      ) : null}

      {cancellationMessage ? (
        <p className="text-xs font-medium text-red-700">{cancellationMessage}</p>
      ) : null}

      {!isCancelled && pointsLabel ? (
        <p className={`text-xs font-semibold ${pointsClassName}`}>{pointsLabel}</p>
      ) : null}
    </article>
  );
}
