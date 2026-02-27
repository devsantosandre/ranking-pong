"use client";

import { AppShell } from "@/components/app-shell";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { MatchListSkeleton } from "@/components/skeletons";
import {
  adminGetAllMatches,
  adminCancelMatch,
  type AdminMatch,
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

export default function AdminPartidasPage() {
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

  // Modal de confirmacao
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    matchId: string;
    matchName: string;
    isValidated: boolean;
  }>({ isOpen: false, matchId: "", matchName: "", isValidated: false });

  const loadMatches = async (reset = true) => {
    if (reset) {
      setLoading(true);
      setPage(0);
    } else {
      setLoadingMore(true);
    }
    try {
      const currentPage = reset ? 0 : page;
      const result = await adminGetAllMatches(
        statusFilter !== "todas" ? { status: statusFilter } : undefined,
        currentPage
      );
      if (reset) {
        setMatches(result.matches);
      } else {
        setMatches((prev) => [...prev, ...result.matches]);
      }
      setHasMore(result.hasMore);
      if (!reset) {
        setPage((p) => p + 1);
      } else {
        setPage(1);
      }
    } catch {
      setError("Erro ao carregar partidas");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadMatches(true);
  }, [statusFilter]);

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
  };

  const handleConfirmCancel = async () => {
    setSaving(true);
    try {
      await adminCancelMatch(confirmModal.matchId, cancelReason);
      setCancelingId(null);
      setCancelReason("");
      setFieldError("");
      setError("");
      // Invalidar queries de ranking se for partida validada (pontos foram revertidos)
      if (confirmModal.isValidated) {
        queryClient.invalidateQueries({ queryKey: ["users"] });
        queryClient.invalidateQueries({ queryKey: ["matches"] });
      }
      loadMatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar");
    } finally {
      setSaving(false);
      setConfirmModal({ isOpen: false, matchId: "", matchName: "", isValidated: false });
    }
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
                        className={`inline-block rounded-full px-2 py-1 text-[10px] font-semibold ${
                          statusColors[match.status] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {match.status}
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

                  {/* Acao de cancelar */}
                  {match.status !== "cancelado" && (
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
                      )}
                    </>
                  )}
                </article>
              );
            })}

            {/* Botao Carregar mais */}
            <LoadMoreButton
              onClick={() => loadMatches(false)}
              isLoading={loadingMore}
              hasMore={hasMore}
            />
          </div>
        )}
      </div>

      {/* Modal de confirmacao */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({ isOpen: false, matchId: "", matchName: "", isValidated: false })
        }
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
      />
    </AppShell>
  );
}
