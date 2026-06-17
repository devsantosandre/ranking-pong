"use client";

import { AppShell } from "@/components/app-shell";
import { useAllSeasons, type ClosedSeason } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries";
import {
  adminCloseSeasonNow,
  adminReopenSeason,
  adminActivateSeason,
  adminCreateSeason,
  adminEditSeason,
} from "@/app/actions/seasons";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  Loader2,
  Plus,
  PenLine,
  Play,
  CheckCircle2,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Megaphone,
} from "lucide-react";

// ── tipos e constantes ────────────────────────────────────────────────────────

type SeasonStatus = "upcoming" | "active" | "closed";

const STATUS_LABELS: Record<SeasonStatus, string> = {
  upcoming: "agendada",
  active: "ativa",
  closed: "encerrada",
};

const STATUS_CLASSES: Record<SeasonStatus, string> = {
  upcoming: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  closed: "bg-muted text-muted-foreground",
};

const RECURRENCE_LABELS: Record<string, string> = {
  none: "Sem recorrência",
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
};

function toInputDate(iso: string) {
  return iso.slice(0, 16);
}

function formatDateDisplay(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addPeriod(
  from: string,
  recurrence: string
): { starts_at: string; ends_at: string } {
  const base = new Date(from);
  const d = new Date(base);
  if (recurrence === "weekly") {
    d.setDate(d.getDate() + 7);
  } else if (recurrence === "monthly") {
    d.setMonth(d.getMonth() + 1);
  } else if (recurrence === "quarterly") {
    d.setMonth(d.getMonth() + 3);
  } else if (recurrence === "semiannual") {
    d.setMonth(d.getMonth() + 6);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  const fmt = (dt: Date) => dt.toISOString().slice(0, 16);
  return { starts_at: fmt(base), ends_at: fmt(d) };
}

type FormState = {
  name: string;
  starts_at: string;
  ends_at: string;
  recurrence: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  starts_at: "",
  ends_at: "",
  recurrence: "monthly",
};

type ConfirmLifecycleAction =
  | { type: "close"; season: ClosedSeason }
  | { type: "reopen"; season: ClosedSeason }
  | { type: "activate"; season: ClosedSeason }
  | null;

// ── formulário ────────────────────────────────────────────────────────────────

function SeasonForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial: FormState;
  onSubmit: (data: FormState) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState("");

  const handleRecurrenceChange = (recurrence: string) => {
    const newForm = { ...form, recurrence };
    if (recurrence !== "none" && form.starts_at) {
      const { ends_at } = addPeriod(form.starts_at, recurrence);
      newForm.ends_at = ends_at;
    }
    setForm(newForm);
  };

  const handleStartsAtChange = (starts_at: string) => {
    const newForm = { ...form, starts_at };
    if (form.recurrence !== "none" && starts_at) {
      const { ends_at } = addPeriod(starts_at, form.recurrence);
      newForm.ends_at = ends_at;
    }
    setForm(newForm);
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return "Nome obrigatório";
    if (!form.starts_at) return "Data de início obrigatória";
    if (!form.ends_at) return "Data de término obrigatória";
    if (new Date(form.ends_at) <= new Date(form.starts_at))
      return "Data de término deve ser após o início";
    return null;
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    onSubmit(form);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Nome</label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="ex: Temporada Junho 2026"
          autoFocus
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Recorrência
        </label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.recurrence}
          onChange={(e) => handleRecurrenceChange(e.target.value)}
        >
          {Object.entries(RECURRENCE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Início</label>
          <Input
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) => handleStartsAtChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Término
          </label>
          <Input
            type="datetime-local"
            value={form.ends_at}
            onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1"
        >
          Revisar →
        </Button>
      </div>
    </div>
  );
}

// ── resumo no modal ───────────────────────────────────────────────────────────

function SeasonDataSummary({ data }: { data: FormState }) {
  return (
    <div className="mb-4 rounded-xl bg-muted/40 p-3 text-sm space-y-1.5">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Nome</span>
        <span className="font-medium text-right max-w-[180px] truncate">{data.name}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Início</span>
        <span className="font-medium">{formatDateDisplay(data.starts_at)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Término</span>
        <span className="font-medium">{formatDateDisplay(data.ends_at)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Recorrência</span>
        <span className="font-medium">{RECURRENCE_LABELS[data.recurrence] ?? data.recurrence}</span>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getPlayerName(player: {
  full_name: string | null;
  name: string | null;
  email: string | null;
}): string {
  return player.full_name || player.name || player.email?.split("@")[0] || "—";
}

// ── página principal ──────────────────────────────────────────────────────────

export default function AdminTemporadasPage() {
  const queryClient = useQueryClient();
  const { data: seasons, isLoading, refetch } = useAllSeasons();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Modal de confirmação para criar
  const [createConfirm, setCreateConfirm] = useState<{
    isOpen: boolean;
    data: FormState | null;
    notify: boolean;
  }>({ isOpen: false, data: null, notify: false });

  // Modal de confirmação para editar
  const [editConfirm, setEditConfirm] = useState<{
    isOpen: boolean;
    seasonId: string | null;
    data: FormState | null;
  }>({ isOpen: false, seasonId: null, data: null });

  // Modal de confirmação para encerrar / reabrir
  const [lifecycleConfirm, setLifecycleConfirm] = useState<ConfirmLifecycleAction>(null);

  const showFeedback = (type: "ok" | "err", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.seasons.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.seasonNews });
    refetch();
  };

  // ── criar ─────────────────────────────────────────────────────────────────

  const handleCreateFormSubmit = (data: FormState) => {
    setCreateConfirm({ isOpen: true, data, notify: false });
  };

  const handleCreateConfirm = async () => {
    if (!createConfirm.data) return;
    setActionLoading(true);
    const result = await adminCreateSeason(
      {
        name: createConfirm.data.name,
        starts_at: new Date(createConfirm.data.starts_at).toISOString(),
        ends_at: new Date(createConfirm.data.ends_at).toISOString(),
        recurrence: createConfirm.data.recurrence,
      },
      { notify: createConfirm.notify }
    );
    setActionLoading(false);
    setCreateConfirm({ isOpen: false, data: null, notify: false });
    if (result.success) {
      setShowCreateForm(false);
      showFeedback(
        "ok",
        createConfirm.notify
          ? "Temporada criada e anúncio publicado no feed!"
          : "Temporada criada com sucesso!"
      );
      invalidate();
    } else {
      showFeedback("err", result.error);
    }
  };

  // ── editar ────────────────────────────────────────────────────────────────

  const handleEditFormSubmit = (seasonId: string, data: FormState) => {
    setEditConfirm({ isOpen: true, seasonId, data });
  };

  const handleEditConfirm = async () => {
    if (!editConfirm.seasonId || !editConfirm.data) return;
    setActionLoading(true);
    const result = await adminEditSeason(editConfirm.seasonId, {
      name: editConfirm.data.name,
      starts_at: new Date(editConfirm.data.starts_at).toISOString(),
      ends_at: new Date(editConfirm.data.ends_at).toISOString(),
      recurrence: editConfirm.data.recurrence,
    });
    setActionLoading(false);
    setEditConfirm({ isOpen: false, seasonId: null, data: null });
    if (result.success) {
      setEditingId(null);
      showFeedback("ok", "Temporada atualizada!");
      invalidate();
    } else {
      showFeedback("err", result.error);
    }
  };

  // ── encerrar / reabrir ────────────────────────────────────────────────────

  const handleLifecycleConfirm = async () => {
    if (!lifecycleConfirm) return;
    setActionLoading(true);
    let result;
    if (lifecycleConfirm.type === "close") {
      result = await adminCloseSeasonNow(lifecycleConfirm.season.id);
    } else if (lifecycleConfirm.type === "activate") {
      result = await adminActivateSeason(lifecycleConfirm.season.id);
    } else {
      result = await adminReopenSeason(lifecycleConfirm.season.id);
    }
    const actionType = lifecycleConfirm.type;
    setActionLoading(false);
    setLifecycleConfirm(null);
    if (result.success) {
      showFeedback(
        "ok",
        actionType === "close"
          ? "Temporada encerrada! O campeão foi anunciado no feed."
          : actionType === "activate"
          ? "Temporada ativada com sucesso!"
          : "Temporada reaberta! Anúncio publicado no feed."
      );
      invalidate();
    } else {
      showFeedback("err", result.error);
    }
  };

  const nowIso = new Date().toISOString().slice(0, 16);

  return (
    <AppShell title="Temporadas" subtitle="Gerenciamento" showBack>
      <div className="space-y-4">
        {/* Feedback */}
        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
              feedback.type === "ok"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {feedback.type === "ok" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <X className="h-4 w-4 shrink-0" />
            )}
            {feedback.msg}
          </div>
        )}

        {/* Botão criar */}
        {!showCreateForm && (
          <Button
            size="sm"
            onClick={() => setShowCreateForm(true)}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova temporada
          </Button>
        )}

        {/* Formulário de criação */}
        {showCreateForm && (
          <div className="space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nova temporada
            </p>
            <SeasonForm
              initial={{ ...EMPTY_FORM, starts_at: nowIso }}
              onSubmit={handleCreateFormSubmit}
              onCancel={() => setShowCreateForm(false)}
              loading={actionLoading}
            />
          </div>
        )}

        {/* Lista de temporadas */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !seasons || seasons.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma temporada cadastrada.
          </p>
        ) : (
          <div className="space-y-3">
            {seasons.map((season) => {
              const status = season.status as SeasonStatus;
              const isExpanded = expandedId === season.id;
              const isEditing = editingId === season.id;

              return (
                <div
                  key={season.id}
                  className="rounded-2xl border border-border bg-card shadow-sm"
                >
                  {/* Header do card */}
                  <button
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : season.id)
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground truncate">
                          {season.name}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASSES[status]}`}
                        >
                          {STATUS_LABELS[status]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(season.starts_at).toLocaleDateString("pt-BR")}{" "}
                        →{" "}
                        {new Date(season.ends_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {/* Detalhes expandidos */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                      {isEditing ? (
                        <SeasonForm
                          initial={{
                            name: season.name,
                            starts_at: toInputDate(season.starts_at),
                            ends_at: toInputDate(season.ends_at),
                            recurrence: season.recurrence,
                          }}
                          onSubmit={(data) => handleEditFormSubmit(season.id, data)}
                          onCancel={() => setEditingId(null)}
                          loading={actionLoading}
                        />
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-muted-foreground">Recorrência</p>
                              <p className="font-medium">
                                {RECURRENCE_LABELS[season.recurrence] ?? season.recurrence}
                              </p>
                            </div>
                            {season.champion && status === "closed" && (
                              <div>
                                <p className="text-muted-foreground">Campeão</p>
                                <p className="font-medium text-primary">
                                  🥇 {getPlayerName(season.champion)}
                                </p>
                              </div>
                            )}
                            {season.closed_at && (
                              <div>
                                <p className="text-muted-foreground">Encerrada em</p>
                                <p className="font-medium">
                                  {new Date(season.closed_at).toLocaleDateString("pt-BR")}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {status === "upcoming" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-green-200 text-green-700 hover:bg-green-50"
                                onClick={() =>
                                  setLifecycleConfirm({ type: "activate", season })
                                }
                              >
                                <Play className="mr-1.5 h-3.5 w-3.5" />
                                Ativar
                              </Button>
                            )}

                            {(status === "upcoming" || status === "active") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingId(season.id)}
                              >
                                <PenLine className="mr-1.5 h-3.5 w-3.5" />
                                Editar
                              </Button>
                            )}

                            {status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() =>
                                  setLifecycleConfirm({ type: "close", season })
                                }
                              >
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                Encerrar agora
                              </Button>
                            )}

                            {status === "closed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-blue-200 text-blue-600 hover:bg-blue-50"
                                onClick={() =>
                                  setLifecycleConfirm({ type: "reopen", season })
                                }
                              >
                                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                Reabrir
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal: confirmar CRIAÇÃO ─────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={createConfirm.isOpen}
        onClose={() => setCreateConfirm({ isOpen: false, data: null, notify: false })}
        onConfirm={handleCreateConfirm}
        title="Confirmar criação"
        description="Revise os dados antes de salvar:"
        confirmText="Criar temporada"
        cancelText="Voltar e editar"
        variant="default"
        loading={actionLoading}
      >
        {createConfirm.data && (
          <>
            <SeasonDataSummary data={createConfirm.data} />
            <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={createConfirm.notify}
                onChange={(e) =>
                  setCreateConfirm((p) => ({ ...p, notify: e.target.checked }))
                }
              />
              <span className="flex items-center gap-1.5 text-sm">
                <Megaphone className="h-3.5 w-3.5 text-primary" />
                Publicar anúncio no feed de notícias
              </span>
            </label>
          </>
        )}
      </ConfirmModal>

      {/* ── Modal: confirmar EDIÇÃO ──────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={editConfirm.isOpen}
        onClose={() => setEditConfirm({ isOpen: false, seasonId: null, data: null })}
        onConfirm={handleEditConfirm}
        title="Confirmar alteração"
        description="Revise os novos dados antes de salvar. Edições não geram notícia no feed."
        confirmText="Salvar alteração"
        cancelText="Voltar e editar"
        variant="warning"
        loading={actionLoading}
      >
        {editConfirm.data && <SeasonDataSummary data={editConfirm.data} />}
      </ConfirmModal>

      {/* ── Modal: ATIVAR / ENCERRAR / REABRIR ──────────────────────────────── */}
      <ConfirmModal
        isOpen={!!lifecycleConfirm}
        onClose={() => setLifecycleConfirm(null)}
        onConfirm={handleLifecycleConfirm}
        title={
          lifecycleConfirm?.type === "activate"
            ? "Ativar temporada?"
            : lifecycleConfirm?.type === "close"
            ? "Encerrar temporada?"
            : "Reabrir temporada?"
        }
        description={
          lifecycleConfirm?.type === "activate"
            ? `Isso inicia "${lifecycleConfirm?.season.name}" agora. Apenas uma temporada pode estar ativa por vez — se houver outra ativa, a ativação será bloqueada.`
            : lifecycleConfirm?.type === "close"
            ? `Isso calculará o placar final, declarará o campeão de "${lifecycleConfirm?.season.name}" e publicará automaticamente o anúncio no feed de notícias. Esta ação pode ser revertida com "Reabrir".`
            : `Isso reabre "${lifecycleConfirm?.season.name}", apaga o campeão e publica um anúncio de reabertura no feed. Use somente se cometeu um erro.`
        }
        confirmText={
          lifecycleConfirm?.type === "activate"
            ? "Ativar agora"
            : lifecycleConfirm?.type === "close"
            ? "Encerrar agora"
            : "Confirmar reabertura"
        }
        cancelText="Cancelar"
        variant="warning"
        loading={actionLoading}
      />
    </AppShell>
  );
}
