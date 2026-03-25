"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { MatchListSkeleton } from "@/components/skeletons";
import {
  adminGetAllMatches,
  adminCancelMatch,
  adminGetExceptionalMatchCorrectionPreview,
  adminCorrectMatchWithoutRecalculation,
  type AdminMatch,
  type AdminExceptionalCorrectionPreview,
} from "@/app/actions/admin";

const statusFilters = [
  { value: "todas", label: "Todas" },
  { value: "pendente", label: "Pendentes" },
  { value: "validado", label: "Validadas" },
  { value: "cancelado", label: "Canceladas" },
];

const statusColors: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700",
  validado: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-red-100 text-red-600",
  edited: "bg-blue-100 text-blue-700",
};

const HISTORICAL_CANCEL_BLOCK_MESSAGE =
  "Não é possível cancelar esta partida porque já existem partidas validadas mais recentes envolvendo esses jogadores";

function getAdminMatchStatusBadge(match: AdminMatch) {
  if (match.correction_kind === "without_recalculation") {
    return {
      label: "corrigida sem recálculo",
      className: "bg-amber-100 text-amber-800",
    };
  }

  if (match.status === "validado" && match.aprovado_por === null) {
    return {
      label: "validado pelo sistema",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  return {
    label: match.status,
    className: statusColors[match.status] || "bg-gray-100 text-gray-700",
  };
}

export default function AdminPartidasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("todas");
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [correctionTargetId, setCorrectionTargetId] = useState("");
  const [correctionPreview, setCorrectionPreview] = useState<AdminExceptionalCorrectionPreview | null>(null);
  const [correctionPreviewLoading, setCorrectionPreviewLoading] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionFieldError, setCorrectionFieldError] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [correctionSaving, setCorrectionSaving] = useState(false);
  const [correctionAckRisk, setCorrectionAckRisk] = useState(false);

  // Modal de confirmacao
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    matchId: string;
    matchName: string;
    isValidated: boolean;
  }>({ isOpen: false, matchId: "", matchName: "", isValidated: false });

  const loadMatches = useCallback(async (pageToLoad: number, reset: boolean) => {
    if (reset) {
      setLoading(true);
      setPage(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const result = await adminGetAllMatches(
        statusFilter !== "todas" ? { status: statusFilter } : undefined,
        pageToLoad
      );
      if (reset) {
        setMatches(result.matches);
      } else {
        setMatches((prev) => [...prev, ...result.matches]);
      }
      setHasMore(result.hasMore);
      setPage(pageToLoad + 1);
    } catch {
      setError("Erro ao carregar partidas");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadMatches(0, true);
  }, [loadMatches]);

  const handleReasonChange = (value: string) => {
    setCancelReason(value);
    if (!value.trim()) {
      setFieldError("Motivo do cancelamento e obrigatorio");
    } else if (value.trim().length < 5) {
      setFieldError("Motivo deve ter pelo menos 5 caracteres");
    } else {
      setFieldError("");
    }
  };

  const canUseExceptionalCorrection = user?.role === "admin";

  const resetExceptionalCorrectionModal = () => {
    setCorrectionModalOpen(false);
    setCorrectionTargetId("");
    setCorrectionPreview(null);
    setCorrectionPreviewLoading(false);
    setCorrectionReason("");
    setCorrectionFieldError("");
    setCorrectionError("");
    setCorrectionSaving(false);
    setCorrectionAckRisk(false);
  };

  const handleCorrectionReasonChange = (value: string) => {
    setCorrectionReason(value);
    if (!value.trim()) {
      setCorrectionFieldError("Motivo da correção é obrigatório");
    } else if (value.trim().length < 5) {
      setCorrectionFieldError("Explique o motivo com pelo menos 5 caracteres");
    } else {
      setCorrectionFieldError("");
    }
  };

  const handleCancelClick = (match: AdminMatch) => {
    if (!cancelReason.trim()) {
      setFieldError("Motivo do cancelamento e obrigatorio");
      return;
    }
    if (cancelReason.trim().length < 5) {
      setFieldError("Motivo deve ter pelo menos 5 caracteres");
      return;
    }

    const playerA = match.player_a?.full_name || match.player_a?.name || "Jogador A";
    const playerB = match.player_b?.full_name || match.player_b?.name || "Jogador B";

    setConfirmModal({
      isOpen: true,
      matchId: match.id,
      matchName: `${playerA} vs ${playerB} (${match.resultado_a}x${match.resultado_b})`,
      isValidated: match.status === "validado",
    });
    setConfirmError("");
  };

  const handleOpenExceptionalCorrection = async (match: AdminMatch) => {
    if (!canUseExceptionalCorrection) return;

    setConfirmModal({ isOpen: false, matchId: "", matchName: "", isValidated: false });
    setConfirmError("");
    setCorrectionModalOpen(true);
    setCorrectionTargetId(match.id);
    setCorrectionPreview(null);
    setCorrectionPreviewLoading(true);
    setCorrectionReason(cancelingId === match.id ? cancelReason : "");
    setCorrectionFieldError("");
    setCorrectionError("");
    setCorrectionAckRisk(false);

    const result = await adminGetExceptionalMatchCorrectionPreview(match.id);

    if (!result.success) {
      console.error("admin_partidas_exceptional_correction_preview_failed", {
        matchId: match.id,
        message: result.error,
      });
      setCorrectionError(result.error);
      setCorrectionPreviewLoading(false);
      return;
    }

    setCorrectionPreview(result.preview);
    setCorrectionPreviewLoading(false);
  };

  const handleConfirmCancel = async () => {
    setSaving(true);
    try {
      const result = await adminCancelMatch(confirmModal.matchId, cancelReason);
      if (!result.success) {
        setError(result.error);
        setConfirmError(result.error);
        return false;
      }
      setCancelingId(null);
      setCancelReason("");
      setFieldError("");
      setError("");
      // Invalidar queries de ranking se for partida validada (pontos foram revertidos)
      if (confirmModal.isValidated) {
        queryClient.invalidateQueries({ queryKey: ["users"] });
        queryClient.invalidateQueries({ queryKey: ["matches"] });
      }
      await loadMatches(0, true);
      setConfirmError("");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao cancelar";
      setError(message);
      setConfirmError(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmExceptionalCorrection = async () => {
    if (!correctionTargetId) return;

    if (!correctionReason.trim()) {
      setCorrectionFieldError("Motivo da correção é obrigatório");
      return;
    }

    if (correctionReason.trim().length < 5) {
      setCorrectionFieldError("Explique o motivo com pelo menos 5 caracteres");
      return;
    }

    if (!correctionAckRisk) {
      setCorrectionError(
        "Leia os avisos e confirme ciência antes de aplicar a correção excepcional."
      );
      return;
    }

    setCorrectionSaving(true);
    setCorrectionError("");

    const result = await adminCorrectMatchWithoutRecalculation(
      correctionTargetId,
      correctionReason.trim()
    );

    if (!result.success) {
      console.error("admin_partidas_exceptional_correction_failed", {
        matchId: correctionTargetId,
        reasonLength: correctionReason.trim().length,
        message: result.error,
      });
      setCorrectionError(result.error);
      setCorrectionSaving(false);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["matches"] });
    await loadMatches(0, true);
    setCancelingId(null);
    setCancelReason("");
    setFieldError("");
    setError("");
    setConfirmError("");
    resetExceptionalCorrectionModal();
    setConfirmModal({ isOpen: false, matchId: "", matchName: "", isValidated: false });
    setCorrectionSaving(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AppShell title="Partidas" subtitle="Gerenciar partidas" showBack>
      <div className="space-y-4">
        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                statusFilter === filter.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-foreground hover:border-primary/50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Erro */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {error}
            <button onClick={() => setError("")} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <MatchListSkeleton count={5} />
        ) : matches.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma partida encontrada
          </p>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => {
              const statusBadge = getAdminMatchStatusBadge(match);
              const isPlayerAWinner =
                match.vencedor_id === match.player_a_id
                  ? true
                  : match.vencedor_id === match.player_b_id
                    ? false
                    : match.resultado_a >= match.resultado_b;

              const winner = isPlayerAWinner ? match.player_a : match.player_b;
              const loser = isPlayerAWinner ? match.player_b : match.player_a;
              const winnerScore = isPlayerAWinner ? match.resultado_a : match.resultado_b;
              const loserScore = isPlayerAWinner ? match.resultado_b : match.resultado_a;
              const winnerPointsRaw = isPlayerAWinner
                ? match.pontos_variacao_a
                : match.pontos_variacao_b;
              const loserPointsRaw = isPlayerAWinner
                ? match.pontos_variacao_b
                : match.pontos_variacao_a;
              const winnerPoints =
                typeof winnerPointsRaw === "number" ? Math.abs(winnerPointsRaw) : null;
              const loserPoints =
                typeof loserPointsRaw === "number" ? Math.abs(loserPointsRaw) : null;
              const winnerName = winner?.full_name || winner?.name || "Vencedor";
              const loserName = loser?.full_name || loser?.name || "Perdedor";
              const safeCancelAvailable =
                match.status !== "validado" || match.can_cancel_safely !== false;

              return (
                <article
                  key={match.id}
                  className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Resultado
                    </p>
                    <div className="text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-[10px] font-semibold ${statusBadge.className}`}
                      >
                        {statusBadge.label}
                      </span>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatDate(match.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Jogadores + placar (vencedor sempre à esquerda) */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="text-left">
                      <p className="text-sm font-semibold text-emerald-700">
                        {winnerName}
                      </p>
                      <p className="text-xs text-muted-foreground">Vencedor</p>
                    </div>
                    <p className="text-center text-2xl font-bold text-primary">
                      {winnerScore} x {loserScore}
                    </p>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-600">
                        {loserName}
                      </p>
                      <p className="text-xs text-muted-foreground">Perdedor</p>
                    </div>
                  </div>

                  {/* Pontos */}
                  {match.status === "validado" &&
                    winnerPoints !== null &&
                    loserPoints !== null && (
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <p className="text-center font-semibold text-emerald-600">
                          +{winnerPoints} pts
                        </p>
                        <p className="text-center font-semibold text-red-600">
                          -{loserPoints} pts
                        </p>
                      </div>
                    )}

                  {match.status === "validado" &&
                  match.aprovado_por === null &&
                  !match.correction_kind ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Se esse placar estiver incorreto e novos jogos acontecerem antes da
                      correção, o ranking pode sofrer impacto em cadeia.
                    </div>
                  ) : null}

                  {match.correction_kind === "without_recalculation" ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Correção excepcional aplicada. Esta partida foi retirada do ranking,
                      com compensação apenas entre os dois jogadores, sem recalcular jogos
                      posteriores.
                    </div>
                  ) : null}

                  {match.status === "validado" && !safeCancelAvailable ? (
                    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                      <p className="font-semibold">
                        Cancelamento com reversão indisponível
                      </p>
                      <p>
                        {match.cancel_unavailable_reason ||
                          "Já existem partidas validadas mais recentes envolvendo esses jogadores."}
                      </p>
                      <p>
                        Por isso o sistema não mostra mais o botão de cancelar e
                        reverter pontos neste caso.
                      </p>
                      <Link
                        href="/admin/partidas/correcao-sem-recalculo"
                        className="inline-flex font-semibold text-amber-800 underline-offset-4 hover:underline"
                      >
                        Saiba mais
                      </Link>
                    </div>
                  ) : null}

                  {/* Acao de cancelar */}
                  {match.status !== "cancelado" && safeCancelAvailable && (
                    <>
                      {cancelingId === match.id ? (
                        <div className="space-y-2">
                          <div>
                            <textarea
                              value={cancelReason}
                              onChange={(e) => handleReasonChange(e.target.value)}
                              placeholder="Motivo do cancelamento (obrigatorio)"
                              className={`w-full rounded-lg border bg-background p-2 text-sm placeholder:text-muted-foreground focus:outline-none ${
                                fieldError
                                  ? "border-red-500 focus:border-red-500"
                                  : "border-border focus:border-primary"
                              }`}
                              rows={2}
                            />
                            {fieldError && (
                              <p className="mt-1 text-xs text-red-500">
                                {fieldError}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => {
                                setCancelingId(null);
                                setCancelReason("");
                                setFieldError("");
                              }}
                            >
                              Voltar
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 bg-red-600 hover:bg-red-700"
                              onClick={() => handleCancelClick(match)}
                              disabled={!!fieldError}
                            >
                              Confirmar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setCancelingId(match.id)}
                          >
                            <X className="mr-1 h-4 w-4" />
                            {match.status === "validado"
                              ? "Cancelar e Reverter Pontos"
                              : "Cancelar Partida"}
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {match.status === "validado" &&
                  !safeCancelAvailable &&
                  canUseExceptionalCorrection ? (
                    <Button
                      size="sm"
                      type="button"
                      className="w-full bg-amber-600 text-white hover:bg-amber-700"
                      onClick={() => void handleOpenExceptionalCorrection(match)}
                    >
                      Corrigir sem recálculo
                    </Button>
                  ) : null}
                </article>
              );
            })}

            {/* Botao Carregar mais */}
            <LoadMoreButton
              onClick={() => void loadMatches(page, false)}
              isLoading={loadingMore}
              hasMore={hasMore}
            />
          </div>
        )}
      </div>

      {/* Modal de confirmacao */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => {
          setConfirmModal({ isOpen: false, matchId: "", matchName: "", isValidated: false });
          setConfirmError("");
        }}
        onConfirm={handleConfirmCancel}
        title="Cancelar partida"
        description={
          confirmModal.isValidated
            ? `Deseja cancelar a partida "${confirmModal.matchName}"? Os pontos serao revertidos automaticamente.`
            : `Deseja cancelar a partida "${confirmModal.matchName}"?`
        }
        confirmText="Cancelar partida"
        cancelText="Voltar"
        variant="danger"
        loading={saving}
        errorMessage={confirmError}
      >
        {canUseExceptionalCorrection &&
        confirmError === HISTORICAL_CANCEL_BLOCK_MESSAGE &&
        confirmModal.isValidated ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
            <p className="font-semibold">Correção excepcional disponível</p>
            <p className="mt-1">
              Use somente quando a partida ficou antiga, o cancelamento seguro não é
              mais possível e o ranking já foi prejudicado por um placar incorreto.
            </p>
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-amber-800 underline-offset-4 hover:underline"
              onClick={() => {
                const targetMatch = matches.find((match) => match.id === confirmModal.matchId);
                if (!targetMatch) return;
                void handleOpenExceptionalCorrection(targetMatch);
              }}
            >
              Abrir correção sem recálculo
            </button>
          </div>
        ) : null}
      </ConfirmModal>

      {correctionModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:items-center sm:p-4">
          <div className="relative flex max-h-[calc(100vh-7rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xl sm:max-h-[calc(100vh-2rem)]">
            <button
              type="button"
              onClick={resetExceptionalCorrectionModal}
              className="absolute right-4 top-4 z-10 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="overflow-y-auto px-4 pb-4 pt-5 sm:px-5 sm:pb-5">
              <div className="flex items-start gap-3 pr-12">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    Corrigir sem recálculo
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Use só quando o cancelamento seguro já não é mais possível e o
                    placar errado já prejudicou o ranking.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">Resumo rápido</p>
                <p className="mt-1 leading-relaxed">
                  Esta correção compensa só os dois jogadores desta partida. Jogos
                  posteriores não serão recalculados, então podem restar efeitos
                  indiretos no ranking.
                </p>
                <Link
                  href="/admin/partidas/correcao-sem-recalculo"
                  className="mt-3 inline-flex text-sm font-semibold text-amber-800 underline-offset-4 hover:underline"
                >
                  Saiba mais
                </Link>
              </div>

              <div className="mt-4 rounded-2xl border border-border/70 bg-muted/15 p-4">
                {correctionPreviewLoading ? (
                  <p className="text-sm text-muted-foreground">Analisando impacto da correção...</p>
                ) : correctionPreview ? (
                  <div className="space-y-2 text-sm text-foreground">
                    <p className="font-semibold">
                      {correctionPreview.playerAName} vs {correctionPreview.playerBName} ({correctionPreview.scoreLabel})
                    </p>
                    <p className="text-muted-foreground">
                      Pontos desta partida foram aplicados em{" "}
                      {formatDate(correctionPreview.appliedAt)}.
                    </p>
                    <div className="grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-3">
                      <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                          Impacto direto
                        </p>
                        <p className="mt-1 font-semibold">
                          {correctionPreview.directMatchCount} partida(s)
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                          Em cadeia
                        </p>
                        <p className="mt-1 font-semibold">
                          {correctionPreview.cascadeMatchCount} partida(s)
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                          Jogadores afetados
                        </p>
                        <p className="mt-1 font-semibold">
                          {correctionPreview.cascadePlayerCount} jogador(es)
                        </p>
                      </div>
                    </div>
                    {correctionPreview.isAutoValidated ? (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                        Esta partida foi confirmada automaticamente pelo sistema. Se o
                        placar estava errado, o prejuízo pode ter se espalhado para o
                        ranking e a sequência de vitórias.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    A análise aparece aqui assim que ficar disponível.
                  </p>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Motivo da correção
                </label>
                <textarea
                  value={correctionReason}
                  onChange={(event) => handleCorrectionReasonChange(event.target.value)}
                  rows={3}
                  placeholder="Explique o erro, por que a correção excepcional está sendo usada e qual foi o prejuízo no ranking"
                  className={`w-full rounded-2xl border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none ${
                    correctionFieldError
                      ? "border-red-500 focus:border-red-500"
                      : "border-border focus:border-primary"
                  }`}
                />
                {correctionFieldError ? (
                  <p className="text-xs text-red-600">{correctionFieldError}</p>
                ) : null}
              </div>

              <div className="mt-4 space-y-3 rounded-2xl border border-border/70 bg-card/80 p-4">
                <label className="flex items-start gap-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={correctionAckRisk}
                    onChange={(event) => setCorrectionAckRisk(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border"
                  />
                  <span>
                    Entendi que esta correção é excepcional, não recalcula jogos
                    posteriores e pode manter efeitos indiretos no ranking.
                  </span>
                </label>
              </div>

              {correctionError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {correctionError}
                </div>
              ) : null}
            </div>

            <div className="border-t border-border bg-card px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={resetExceptionalCorrectionModal}
                  disabled={correctionSaving}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-amber-600 text-white hover:bg-amber-700"
                  onClick={() => void handleConfirmExceptionalCorrection()}
                  disabled={correctionSaving || correctionPreviewLoading || !correctionPreview}
                >
                  {correctionSaving ? "Aguarde..." : "Aplicar correção excepcional"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
