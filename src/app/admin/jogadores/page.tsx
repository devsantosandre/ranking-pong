"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  X,
  Search,
  Key,
  TrendingUp,
  Power,
  RotateCcw,
  Shield,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import {
  adminGetAllUsers,
  adminCreateUser,
  adminResetPassword,
  adminUpdateUserRating,
  adminToggleUserStatus,
  adminToggleHideFromRanking,
  adminResetUserStats,
  adminChangeUserRole,
  type AdminUser,
} from "@/app/actions/admin";
import { PlayerListSkeleton } from "@/components/skeletons";

const roleLabels: Record<string, string> = {
  player: "Jogador",
  moderator: "Moderador",
  admin: "Admin",
};

const roleColors: Record<string, string> = {
  player: "bg-gray-100 text-gray-700",
  moderator: "bg-blue-100 text-blue-700",
  admin: "bg-purple-100 text-purple-700",
};

const statusFilters = [
  { value: "todos", label: "Todos" },
  { value: "ativos", label: "Ativos" },
  { value: "inativos", label: "Inativos" },
];

const roleFilters = [
  { value: "todos", label: "Todos" },
  { value: "player", label: "Jogador" },
  { value: "moderator", label: "Moderador" },
  { value: "admin", label: "Admin" },
];

type ConfirmAction = {
  type: "toggle_status" | "reset_stats" | "change_role" | "reset_password" | "toggle_hide_from_ranking";
  userId: string;
  userName: string;
  extra?: string; // para role ou senha
};

export default function AdminJogadoresPage() {
  const { isAdmin, user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [roleFilter, setRoleFilter] = useState("todos");

  // Estados para formulario de adicionar
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
  const [addErrors, setAddErrors] = useState({ name: "", email: "", password: "" });
  const [addLoading, setAddLoading] = useState(false);

  // Estados para resetar senha
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Estados para editar rating
  const [editRatingId, setEditRatingId] = useState<string | null>(null);
  const [newRating, setNewRating] = useState("");
  const [ratingReason, setRatingReason] = useState("");
  const [ratingErrors, setRatingErrors] = useState({ rating: "", reason: "" });
  const [ratingLoading, setRatingLoading] = useState(false);

  // Modal de confirmacao
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: ConfirmAction | null;
  }>({ isOpen: false, action: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadUsers = async (reset = true) => {
    if (reset) {
      setLoading(true);
      setPage(0);
    } else {
      setLoadingMore(true);
    }
    try {
      const currentPage = reset ? 0 : page;
      const filters = {
        status: statusFilter !== "todos" ? statusFilter : undefined,
        role: roleFilter !== "todos" ? roleFilter : undefined,
      };
      const result = await adminGetAllUsers(filters, currentPage);
      if (reset) {
        setUsers(result.users);
      } else {
        setUsers((prev) => [...prev, ...result.users]);
      }
      setHasMore(result.hasMore);
      if (!reset) {
        setPage((p) => p + 1);
      } else {
        setPage(1);
      }
    } catch {
      // Error handling
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Recarregar quando filtros mudarem
  useEffect(() => {
    loadUsers(true);
  }, [statusFilter, roleFilter]);

  // Busca por texto (filtros de status/role ja vem do backend)
  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Validacoes
  const validateAddUser = (): boolean => {
    const errors = { name: "", email: "", password: "" };
    let isValid = true;

    if (!newUser.name.trim()) {
      errors.name = "Nome e obrigatorio";
      isValid = false;
    } else if (newUser.name.trim().length < 2) {
      errors.name = "Nome deve ter pelo menos 2 caracteres";
      isValid = false;
    }

    if (!newUser.email.trim()) {
      errors.email = "Email e obrigatorio";
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) {
      errors.email = "Email invalido";
      isValid = false;
    }

    if (!newUser.password) {
      errors.password = "Senha e obrigatoria";
      isValid = false;
    } else if (newUser.password.length < 6) {
      errors.password = "Senha deve ter no minimo 6 caracteres";
      isValid = false;
    }

    setAddErrors(errors);
    return isValid;
  };

  const validatePassword = (password: string): string => {
    if (!password) return "Senha e obrigatoria";
    if (password.length < 6) return "Senha deve ter no minimo 6 caracteres";
    return "";
  };

  const validateRating = (): boolean => {
    const errors = { rating: "", reason: "" };
    let isValid = true;

    const rating = parseInt(newRating);
    if (isNaN(rating)) {
      errors.rating = "Rating deve ser um numero";
      isValid = false;
    } else if (rating < 0) {
      errors.rating = "Rating deve ser maior ou igual a zero";
      isValid = false;
    } else if (rating > 10000) {
      errors.rating = "Rating deve ser menor que 10.000";
      isValid = false;
    }

    if (!ratingReason.trim()) {
      errors.reason = "Motivo e obrigatorio";
      isValid = false;
    } else if (ratingReason.trim().length < 5) {
      errors.reason = "Motivo deve ter pelo menos 5 caracteres";
      isValid = false;
    }

    setRatingErrors(errors);
    return isValid;
  };

  // Handlers
  const handleAddUser = async () => {
    if (!validateAddUser()) return;

    setAddLoading(true);
    try {
      await adminCreateUser(newUser.name, newUser.email, newUser.password);
      setShowAddForm(false);
      setNewUser({ name: "", email: "", password: "" });
      setAddErrors({ name: "", email: "", password: "" });
      loadUsers();
    } catch (err) {
      setAddErrors({
        ...addErrors,
        email: err instanceof Error ? err.message : "Erro ao criar jogador",
      });
    } finally {
      setAddLoading(false);
    }
  };

  const handleResetPasswordClick = (userId: string, userName: string) => {
    const error = validatePassword(newPassword);
    if (error) {
      setPasswordError(error);
      return;
    }

    setConfirmModal({
      isOpen: true,
      action: {
        type: "reset_password",
        userId,
        userName,
        extra: newPassword,
      },
    });
  };

  const handleUpdateRating = async (userId: string) => {
    if (!validateRating()) return;

    setRatingLoading(true);
    try {
      await adminUpdateUserRating(userId, parseInt(newRating), ratingReason);
      setEditRatingId(null);
      setNewRating("");
      setRatingReason("");
      setRatingErrors({ rating: "", reason: "" });
      // Invalidar queries de ranking pois rating mudou
      queryClient.invalidateQueries({ queryKey: ["users"] });
      loadUsers();
    } catch (err) {
      setRatingErrors({
        ...ratingErrors,
        rating: err instanceof Error ? err.message : "Erro ao atualizar rating",
      });
    } finally {
      setRatingLoading(false);
    }
  };

  const handleToggleStatusClick = (user: AdminUser) => {
    setConfirmModal({
      isOpen: true,
      action: {
        type: "toggle_status",
        userId: user.id,
        userName: user.full_name || user.name || "Jogador",
        extra: user.is_active ? "desativar" : "ativar",
      },
    });
  };

  const handleResetStatsClick = (user: AdminUser) => {
    setConfirmModal({
      isOpen: true,
      action: {
        type: "reset_stats",
        userId: user.id,
        userName: user.full_name || user.name || "Jogador",
      },
    });
  };

  const handleChangeRoleClick = (
    user: AdminUser,
    newRole: "player" | "moderator" | "admin"
  ) => {
    if (user.role === newRole) return;

    setConfirmModal({
      isOpen: true,
      action: {
        type: "change_role",
        userId: user.id,
        userName: user.full_name || user.name || "Jogador",
        extra: newRole,
      },
    });
  };

  const handleToggleHideFromRankingClick = (user: AdminUser) => {
    setConfirmModal({
      isOpen: true,
      action: {
        type: "toggle_hide_from_ranking",
        userId: user.id,
        userName: user.full_name || user.name || "Jogador",
        extra: user.hide_from_ranking ? "mostrar" : "ocultar",
      },
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmModal.action) return;

    setConfirmLoading(true);
    try {
      const { type, userId, extra } = confirmModal.action;

      switch (type) {
        case "toggle_status":
          await adminToggleUserStatus(userId);
          // Invalidar queries de ranking pois status afeta quem aparece
          queryClient.invalidateQueries({ queryKey: ["users"] });
          break;
        case "toggle_hide_from_ranking":
          await adminToggleHideFromRanking(userId);
          // Invalidar queries de ranking pois hide_from_ranking afeta quem aparece
          queryClient.invalidateQueries({ queryKey: ["users"] });
          break;
        case "reset_stats":
          await adminResetUserStats(userId);
          // Invalidar queries de ranking pois stats mudaram
          queryClient.invalidateQueries({ queryKey: ["users"] });
          break;
        case "change_role":
          await adminChangeUserRole(userId, extra as "player" | "moderator" | "admin");
          break;
        case "reset_password":
          await adminResetPassword(userId, extra as string);
          setResetPasswordId(null);
          setNewPassword("");
          setPasswordError("");
          break;
      }

      loadUsers();
    } catch (err) {
      // Mostrar erro ao usuário
      const errorMessage = err instanceof Error ? err.message : "Erro ao executar acao";
      alert(errorMessage);
    } finally {
      setConfirmLoading(false);
      setConfirmModal({ isOpen: false, action: null });
    }
  };

  const getConfirmModalProps = () => {
    if (!confirmModal.action) {
      return { title: "", description: "", variant: "default" as const };
    }

    const { type, userName, extra } = confirmModal.action;

    switch (type) {
      case "toggle_status":
        return {
          title: extra === "desativar" ? "Desativar jogador" : "Ativar jogador",
          description:
            extra === "desativar"
              ? `Deseja desativar "${userName}"? O jogador nao podera fazer login e nao aparecera no ranking.`
              : `Deseja ativar "${userName}"? O jogador podera fazer login novamente.`,
          variant: extra === "desativar" ? ("danger" as const) : ("default" as const),
        };
      case "toggle_hide_from_ranking":
        return {
          title: extra === "ocultar" ? "Ocultar do ranking" : "Mostrar no ranking",
          description:
            extra === "ocultar"
              ? `Deseja ocultar "${userName}" do ranking? O jogador continuara ativo e podera fazer login, mas nao aparecera na listagem do ranking e nao podera registrar partidas. Ideal para administradores que querem apenas observar. IMPORTANTE: Nao e possivel ocultar se houver partidas pendentes.`
              : `Deseja mostrar "${userName}" no ranking? O jogador voltara a aparecer na listagem do ranking e podera registrar partidas novamente.`,
          variant: "default" as const,
        };
      case "reset_stats":
        return {
          title: "Resetar estatisticas",
          description: `Deseja resetar todas as estatisticas de "${userName}"? Vitorias, derrotas e rating serao zerados. Esta acao e irreversivel.`,
          variant: "danger" as const,
        };
      case "change_role":
        return {
          title: "Alterar permissao",
          description: `Deseja alterar a permissao de "${userName}" para ${roleLabels[extra as string]}?`,
          variant: "warning" as const,
        };
      case "reset_password":
        return {
          title: "Resetar senha",
          description: `Deseja resetar a senha de "${userName}"? O jogador devera usar a nova senha temporaria para fazer login.`,
          variant: "warning" as const,
        };
      default:
        return { title: "", description: "", variant: "default" as const };
    }
  };

  return (
    <AppShell title="Jogadores" subtitle="Gerenciar jogadores" showBack>
      <div className="space-y-4">
        {/* Botao Adicionar */}
        <Button
          onClick={() => setShowAddForm(true)}
          className="w-full"
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Jogador
        </Button>

        {/* Formulario Adicionar */}
        {showAddForm && (
          <div className="space-y-3 rounded-xl border border-primary bg-primary/5 p-4">
            <h3 className="font-semibold">Novo Jogador</h3>
            <div>
              <Input
                placeholder="Nome completo"
                value={newUser.name}
                onChange={(e) => {
                  setNewUser({ ...newUser, name: e.target.value });
                  if (addErrors.name) setAddErrors({ ...addErrors, name: "" });
                }}
                className={addErrors.name ? "border-red-500" : ""}
              />
              {addErrors.name && (
                <p className="mt-1 text-xs text-red-500">{addErrors.name}</p>
              )}
            </div>
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => {
                  setNewUser({ ...newUser, email: e.target.value });
                  if (addErrors.email) setAddErrors({ ...addErrors, email: "" });
                }}
                className={addErrors.email ? "border-red-500" : ""}
              />
              {addErrors.email && (
                <p className="mt-1 text-xs text-red-500">{addErrors.email}</p>
              )}
            </div>
            <div>
              <Input
                type="text"
                placeholder="Senha temporaria"
                value={newUser.password}
                onChange={(e) => {
                  setNewUser({ ...newUser, password: e.target.value });
                  if (addErrors.password) setAddErrors({ ...addErrors, password: "" });
                }}
                className={addErrors.password ? "border-red-500" : ""}
              />
              {addErrors.password && (
                <p className="mt-1 text-xs text-red-500">{addErrors.password}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setShowAddForm(false);
                  setNewUser({ name: "", email: "", password: "" });
                  setAddErrors({ name: "", email: "", password: "" });
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleAddUser}
                disabled={addLoading}
              >
                {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
              </Button>
            </div>
          </div>
        )}

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar jogador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filtros */}
        <div className="space-y-2">
          {/* Status */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === filter.value
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Role */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {roleFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setRoleFilter(filter.value)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  roleFilter === filter.value
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <PlayerListSkeleton count={6} />
        ) : filteredUsers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum jogador encontrado
          </p>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((player) => {
              const isExpanded = expandedUser === player.id;
              const isCurrentUser = currentUser?.id === player.id;

              return (
                <article
                  key={player.id}
                  className={`rounded-2xl border bg-card shadow-sm transition ${
                    !player.is_active
                      ? "border-red-200 bg-red-50/50"
                      : "border-border"
                  }`}
                >
                  {/* Header clicavel */}
                  <button
                    onClick={() =>
                      setExpandedUser(isExpanded ? null : player.id)
                    }
                    className="flex w-full items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                          player.is_active
                            ? "bg-primary/10 text-primary"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {(player.full_name || player.name || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">
                          {player.full_name || player.name}
                          {isCurrentUser && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (voce)
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              roleColors[player.role]
                            }`}
                          >
                            {roleLabels[player.role]}
                          </span>
                          {!player.is_active && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                              Inativo
                            </span>
                          )}
                          {player.hide_from_ranking && (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-600">
                              Observador
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-primary">
                          {player.rating_atual} pts
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {player.vitorias}V / {player.derrotas}D
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Acoes expandidas */}
                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-3">
                      <p className="text-xs text-muted-foreground">
                        {player.email}
                      </p>

                      {/* Resetar Senha */}
                      {resetPasswordId === player.id ? (
                        <div className="space-y-2">
                          <div>
                            <Input
                              type="text"
                              placeholder="Nova senha temporaria"
                              value={newPassword}
                              onChange={(e) => {
                                setNewPassword(e.target.value);
                                setPasswordError("");
                              }}
                              className={passwordError ? "border-red-500" : ""}
                            />
                            {passwordError && (
                              <p className="mt-1 text-xs text-red-500">
                                {passwordError}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => {
                                setResetPasswordId(null);
                                setNewPassword("");
                                setPasswordError("");
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() =>
                                handleResetPasswordClick(
                                  player.id,
                                  player.full_name || player.name || "Jogador"
                                )
                              }
                            >
                              Confirmar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => setResetPasswordId(player.id)}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          Resetar Senha
                        </Button>
                      )}

                      {/* Acoes apenas Admin */}
                      {isAdmin && (
                        <>
                          {/* Editar Rating */}
                          {editRatingId === player.id ? (
                            <div className="space-y-2">
                              <div>
                                <Input
                                  type="number"
                                  placeholder="Novo rating"
                                  value={newRating}
                                  onChange={(e) => {
                                    setNewRating(e.target.value);
                                    if (ratingErrors.rating)
                                      setRatingErrors({ ...ratingErrors, rating: "" });
                                  }}
                                  className={ratingErrors.rating ? "border-red-500" : ""}
                                />
                                {ratingErrors.rating && (
                                  <p className="mt-1 text-xs text-red-500">
                                    {ratingErrors.rating}
                                  </p>
                                )}
                              </div>
                              <div>
                                <Input
                                  placeholder="Motivo da alteracao"
                                  value={ratingReason}
                                  onChange={(e) => {
                                    setRatingReason(e.target.value);
                                    if (ratingErrors.reason)
                                      setRatingErrors({ ...ratingErrors, reason: "" });
                                  }}
                                  className={ratingErrors.reason ? "border-red-500" : ""}
                                />
                                {ratingErrors.reason && (
                                  <p className="mt-1 text-xs text-red-500">
                                    {ratingErrors.reason}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => {
                                    setEditRatingId(null);
                                    setNewRating("");
                                    setRatingReason("");
                                    setRatingErrors({ rating: "", reason: "" });
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => handleUpdateRating(player.id)}
                                  disabled={ratingLoading}
                                >
                                  {ratingLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Salvar"
                                  )}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                setEditRatingId(player.id);
                                setNewRating(player.rating_atual.toString());
                              }}
                            >
                              <TrendingUp className="mr-2 h-4 w-4" />
                              Editar Pontos
                            </Button>
                          )}

                          {/* Ativar/Desativar */}
                          <Button
                            size="sm"
                            variant="outline"
                            className={`w-full ${
                              player.is_active
                                ? "text-red-600 hover:bg-red-50"
                                : "text-green-600 hover:bg-green-50"
                            }`}
                            onClick={() => handleToggleStatusClick(player)}
                          >
                            <Power className="mr-2 h-4 w-4" />
                            {player.is_active ? "Desativar" : "Ativar"}
                          </Button>

                          {/* Ocultar/Mostrar no Ranking */}
                          <Button
                            size="sm"
                            variant="outline"
                            className={`w-full ${
                              player.hide_from_ranking
                                ? "text-purple-600 hover:bg-purple-50"
                                : "text-blue-600 hover:bg-blue-50"
                            }`}
                            onClick={() => handleToggleHideFromRankingClick(player)}
                          >
                            {player.hide_from_ranking ? (
                              <Eye className="mr-2 h-4 w-4" />
                            ) : (
                              <EyeOff className="mr-2 h-4 w-4" />
                            )}
                            {player.hide_from_ranking ? "Mostrar no Ranking" : "Ocultar do Ranking"}
                          </Button>

                          {/* Resetar Stats */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-orange-600 hover:bg-orange-50"
                            onClick={() => handleResetStatsClick(player)}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Resetar Estatisticas
                          </Button>

                          {/* Alterar Role */}
                          {!isCurrentUser && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground">
                                Alterar Permissao
                              </p>
                              <div className="flex gap-2">
                                {(
                                  ["player", "moderator", "admin"] as const
                                ).map((role) => (
                                  <Button
                                    key={role}
                                    size="sm"
                                    variant={
                                      player.role === role
                                        ? "default"
                                        : "outline"
                                    }
                                    className="flex-1 text-xs"
                                    onClick={() =>
                                      handleChangeRoleClick(player, role)
                                    }
                                    disabled={player.role === role}
                                  >
                                    <Shield className="mr-1 h-3 w-3" />
                                    {roleLabels[role]}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}

            {/* Botao Carregar mais */}
            <LoadMoreButton
              onClick={() => loadUsers(false)}
              isLoading={loadingMore}
              hasMore={hasMore}
            />
          </div>
        )}
      </div>

      {/* Modal de confirmacao */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, action: null })}
        onConfirm={handleConfirmAction}
        title={getConfirmModalProps().title}
        description={getConfirmModalProps().description}
        confirmText="Confirmar"
        cancelText="Cancelar"
        variant={getConfirmModalProps().variant}
        loading={confirmLoading}
      />
    </AppShell>
  );
}
