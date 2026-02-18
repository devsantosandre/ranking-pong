"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import { usePushSubscription } from "@/lib/hooks/use-push-subscription";
import { useMatches, useUser, useUserRankingPosition } from "@/lib/queries";
import { changePassword } from "@/app/actions/profile";
import {
  AlertTriangle,
  BellOff,
  BellRing,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  Key,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProfilePageSkeleton, MatchListSkeleton } from "@/components/skeletons";
import {
  getPlayerStyle,
  getDivisionName,
  getDivisionNumber,
  isTopThree,
} from "@/lib/divisions";
import { AchievementsSection } from "@/components/achievements-section";

export default function PerfilPage() {
  const { user, loading: authLoading, logout, canAccessAdmin } = useAuth();
  const { data: userStats, isLoading: userStatsLoading } = useUser(user?.id);
  const { data: rankingPosition, isLoading: rankingPositionLoading } = useUserRankingPosition(user?.id);
  const { data: matchesData, isLoading: matchesLoading } = useMatches(user?.id);
  const {
    hasSubscription,
    isConfigured,
    isRequestingPermission,
    isSupported,
    isSyncing,
    permission,
    requestPermissionAndSubscribe,
    syncSubscription,
  } = usePushSubscription();

  const matches = useMemo(() => {
    return matchesData?.pages.flatMap((page) => page.matches) ?? [];
  }, [matchesData]);

  // Estados para alteracao de senha
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [pushFeedback, setPushFeedback] = useState("");

  const isLoading = authLoading || userStatsLoading || rankingPositionLoading;
  const userPosition = rankingPosition ?? 0;

  // Partidas validadas do usuário
  const validatedMatches = useMemo(() => {
    return matches
      .filter((m) => m.status === "validado")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [matches]);

  // Últimas 5 partidas validadas
  const recentMatches = validatedMatches.slice(0, 5);

  // Calcular streak (vitórias consecutivas recentes)
  const streak = useMemo(() => {
    let count = 0;
    for (const match of validatedMatches) {
      if (match.vencedor_id === user?.id) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [validatedMatches, user?.id]);

  // Histórico dos últimos 7 dias (pontos por dia)
  const history = useMemo(() => {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const today = new Date();
    const currentRating = userStats?.rating_atual || 250;
    const result: { label: string; value: number; date: Date }[] = [];
    
    // Criar array dos últimos 7 dias com rating atual
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      result.push({
        label: days[date.getDay()],
        value: currentRating,
        date,
      });
    }
    
    // Calcular rating histórico baseado nas partidas
    const sortedMatches = [...validatedMatches].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    let ratingAtual = currentRating;
    for (const match of sortedMatches) {
      const matchDate = new Date(match.created_at);
      matchDate.setHours(0, 0, 0, 0);
      
      // Encontrar a variação de pontos para o usuário
      let variacao = 0;
      if (match.player_a_id === user?.id) {
        variacao = match.pontos_variacao_a || 0;
      } else if (match.player_b_id === user?.id) {
        variacao = match.pontos_variacao_b || 0;
      }
      
      // Atualizar os dias anteriores à partida
      for (const day of result) {
        if (day.date < matchDate) {
          day.value = ratingAtual - variacao;
        }
      }
      ratingAtual -= variacao;
    }
    
    return result;
  }, [validatedMatches, userStats?.rating_atual, user?.id]);

  // Calcular escala máxima para o gráfico
  const maxRating = useMemo(() => {
    const max = Math.max(...history.map((h) => h.value));
    return Math.ceil(max / 50) * 50 + 50;
  }, [history]);

  const pushStatus = useMemo(() => {
    if (!isConfigured) {
      return {
        label: "Indisponível",
        badgeClass: "border-yellow-200 bg-yellow-50 text-yellow-700",
        description: "Notificações ainda não foram habilitadas no servidor.",
      };
    }

    if (!isSupported) {
      return {
        label: "Não suportado",
        badgeClass: "border-yellow-200 bg-yellow-50 text-yellow-700",
        description: "Este dispositivo ou navegador não suporta notificações push.",
      };
    }

    if (permission === "denied") {
      return {
        label: "Bloqueado",
        badgeClass: "border-red-200 bg-red-50 text-red-700",
        description: "Você bloqueou notificações. Libere nas configurações do navegador.",
      };
    }

    if (permission === "granted" && hasSubscription) {
      return {
        label: "Ativo",
        badgeClass: "border-green-200 bg-green-50 text-green-700",
        description: "Seu dispositivo está inscrito e pronto para receber alertas.",
      };
    }

    if (permission === "granted" && !hasSubscription) {
      return {
        label: "Sincronizando",
        badgeClass: "border-yellow-200 bg-yellow-50 text-yellow-700",
        description: "Permissão concedida. Estamos finalizando o vínculo do dispositivo.",
      };
    }

    return {
      label: "Inativo",
      badgeClass: "border-border bg-muted/40 text-muted-foreground",
      description: "Ative para receber alerta quando surgir pendência de partida.",
    };
  }, [hasSubscription, isConfigured, isSupported, permission]);

  const permissionLabel = useMemo(() => {
    if (!isSupported) return "Indisponível";
    if (permission === "granted") return "Permitida";
    if (permission === "denied") return "Bloqueada";
    return "Não definida";
  }, [isSupported, permission]);

  const getPlayerName = (player: { full_name: string | null; name: string | null; email: string | null }) => {
    return player.full_name || player.name || player.email?.split("@")[0] || "Jogador";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Preencha todos os campos");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Nova senha deve ter no minimo 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Senhas nao conferem");
      return;
    }

    setPasswordLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        setPasswordSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          setShowPasswordForm(false);
          setPasswordSuccess(false);
        }, 2000);
      } else {
        setPasswordError(result.error || "Erro ao alterar senha");
      }
    } catch {
      setPasswordError("Erro ao alterar senha");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleEnablePush = async () => {
    setPushFeedback("");
    const result = await requestPermissionAndSubscribe();

    if (result.ok) {
      setPushFeedback("Notificações ativadas com sucesso.");
      return;
    }

    const reasonMessageMap: Record<string, string> = {
      misconfigured: "Ainda indisponível no servidor. Tente novamente mais tarde.",
      unsupported: "Seu dispositivo não suporta notificações push.",
      permission_denied: "Permissão bloqueada. Libere nas configurações do navegador.",
      permission_not_granted: "Permissão não concedida.",
      subscribe_failed: "Não foi possível ativar agora. Tente novamente.",
      not_authenticated: "Sessão inválida. Faça login novamente.",
    };

    setPushFeedback(reasonMessageMap[result.reason || "subscribe_failed"]);
  };

  const handleVerifyPush = async () => {
    setPushFeedback("");
    await syncSubscription();
    setPushFeedback("Status atualizado.");
  };

  if (isLoading) {
    return (
      <AppShell title="Perfil" subtitle="Carregando..." showBack>
        <ProfilePageSkeleton />
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="Perfil" subtitle="Seus dados e estatísticas" showBack>
        <p className="py-8 text-center text-sm text-muted-foreground">
          Faça login para ver seu perfil
        </p>
      </AppShell>
    );
  }

  const userName = userStats?.full_name || userStats?.name || user.name || "Usuário";
  const vitorias = userStats?.vitorias || 0;
  const derrotas = userStats?.derrotas || 0;
  const totalJogos = vitorias + derrotas;
  const winRate = totalJogos > 0 ? Math.round((vitorias / totalJogos) * 100) : 0;

  // Estilos baseados na posição do usuário
  const isTop3 = userPosition > 0 && isTopThree(userPosition);
  const playerStyle = userPosition > 0 ? getPlayerStyle(userPosition) : null;
  const divisionNumber = userPosition > 0 ? getDivisionNumber(userPosition) : null;
  const divisionName = userPosition > 0 ? getDivisionName(userPosition) : null;
  const useLightBadgeText = isTop3 || (divisionNumber !== null && divisionNumber <= 3);

  return (
    <AppShell title="Perfil" subtitle="Seus dados e estatísticas" showBack>
      <div className="space-y-4">
        {/* Card do perfil */}
        <article className={`space-y-4 rounded-2xl border p-4 shadow-sm ${
          playerStyle ? `${playerStyle.border} ${playerStyle.bg}` : "border-border bg-card"
        }`}>
          <div className="flex items-center gap-4">
            {/* Avatar/Badge */}
            <div className={`relative flex h-14 w-14 items-center justify-center rounded-full ${
              playerStyle ? playerStyle.badge : "bg-primary/15"
            } ${isTop3 ? 'shadow-lg shadow-orange-500/50' : 'shadow-md'}`}>
              {isTop3 && (
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400/30 via-orange-500/20 to-red-500/30 blur-sm" />
              )}
              <span
                className={`relative text-lg font-bold ${
                  playerStyle
                    ? useLightBadgeText
                      ? "text-white drop-shadow-md"
                      : "text-foreground"
                    : "text-primary"
                }`}
              >
                {userPosition > 0 ? `${userPosition}º` : getInitials(userName)}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className={`text-lg font-semibold ${playerStyle ? playerStyle.text : "text-foreground"}`}>
                  {userName}
                </p>
                {isTop3 && playerStyle && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${playerStyle.badge} text-white shadow-sm`}>
                    🔥 TOP {userPosition}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {divisionName && (
                <p className="text-xs text-muted-foreground">{divisionName}</p>
              )}
            </div>
          </div>
        </article>

        <article className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              {pushStatus.label === "Ativo" ? (
                <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Notificações push</p>
                <p className="text-xs text-muted-foreground">{pushStatus.description}</p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${pushStatus.badgeClass}`}
            >
              {pushStatus.label}
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Permissão: <span className="font-medium">{permissionLabel}</span> • Dispositivo:
            <span className="font-medium"> {hasSubscription ? " conectado" : " não conectado"}</span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {isConfigured && isSupported && permission !== "granted" ? (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={isRequestingPermission}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isRequestingPermission ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Ativando...
                  </>
                ) : (
                  "Ativar notificações"
                )}
              </button>
            ) : null}

            {isConfigured && isSupported ? (
              <button
                type="button"
                onClick={handleVerifyPush}
                disabled={isSyncing}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-3 w-3" />
                    Atualizar status
                  </>
                )}
              </button>
            ) : null}
          </div>

          {pushFeedback ? (
            <p className="text-xs text-muted-foreground">{pushFeedback}</p>
          ) : null}

          {!isConfigured && canAccessAdmin ? (
            <p className="text-xs text-muted-foreground">
              Para resolver: configure no servidor as variáveis `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
              `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`.
            </p>
          ) : null}
        </article>

        {/* Estatísticas */}
        <div className="grid grid-cols-4 gap-2">
          <article className="rounded-2xl border border-border bg-card p-3 shadow-sm text-center">
            <p className="text-xl font-bold text-primary">
              {userStats?.rating_atual || user.rating || 250}
            </p>
            <p className="text-[10px] text-muted-foreground">pontos</p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-3 shadow-sm text-center">
            <p className="text-xl font-bold">
              <span className="text-green-600">{vitorias}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-red-500">{derrotas}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">V/D</p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-3 shadow-sm text-center">
            <p className="text-xl font-bold text-foreground">{winRate}%</p>
            <p className="text-[10px] text-muted-foreground">win rate</p>
          </article>
          <article className={`rounded-2xl border p-3 shadow-sm text-center ${
            streak > 0
              ? "border-amber-200 bg-amber-50"
              : "border-border bg-card"
          }`}>
            <p className={`text-xl font-bold ${streak > 0 ? "text-amber-600" : "text-foreground"}`}>
              🔥 {streak}
            </p>
            <p className="text-[10px] text-muted-foreground">streak</p>
          </article>
        </div>

        {/* Conquistas */}
        <AchievementsSection userId={user.id} />

        {/* Histórico dos últimos 7 dias */}
        <div className="space-y-3">
          <p className="px-1 text-sm font-semibold text-foreground">
            Histórico (últimos 7 dias)
          </p>
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-7 items-end gap-2">
              {history.map((point, index) => (
                <div key={index} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-primary">
                    {point.value}
                  </span>
                  <div
                    className="w-full rounded-md bg-primary/80 min-h-[4px]"
                    style={{ height: `${Math.max((point.value / maxRating) * 80, 4)}px` }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {point.label}
                  </span>
                </div>
              ))}
            </div>
            {validatedMatches.length === 0 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Jogue partidas para ver seu progresso!
              </p>
            )}
          </article>
        </div>

        {/* Últimos jogos */}
        <div className="space-y-3">
          <p className="px-1 text-sm font-semibold text-foreground">Últimos jogos</p>
          {matchesLoading ? (
            <MatchListSkeleton count={3} />
          ) : recentMatches.length > 0 ? (
            recentMatches.map((match) => {
              const euSouA = match.player_a_id === user.id;
              const opponent = euSouA ? match.player_b : match.player_a;
              const euVenci = match.vencedor_id === user.id;
              const meusPoints = euSouA ? match.pontos_variacao_a : match.pontos_variacao_b;

              return (
                <article
                  key={match.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        euVenci ? "bg-emerald-100" : "bg-red-100"
                      }`}
                    >
                      <span
                        className={`text-sm font-bold ${
                          euVenci ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {euVenci ? "V" : "D"}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        vs {getPlayerName(opponent)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {match.resultado_a} x {match.resultado_b}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      euVenci ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {meusPoints !== undefined && meusPoints !== null
                      ? (meusPoints >= 0 ? `+${meusPoints}` : meusPoints)
                      : (euVenci ? "+12" : "-12")
                    } pts
                  </span>
                </article>
              );
            })
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum jogo registrado ainda
            </p>
          )}
        </div>

        {/* Link para Regras */}
        <Link
          href="/regras"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold text-foreground">Regras do Ranking</p>
              <p className="text-xs text-muted-foreground">Como funciona a pontuacao ELO</p>
            </div>
          </div>
          <span className="text-muted-foreground">→</span>
        </Link>

        {/* Seguranca - Alterar Senha */}
        <div className="space-y-3">
          <p className="px-1 text-sm font-semibold text-foreground">Seguranca</p>

          {!showPasswordForm ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowPasswordForm(true)}
            >
              <Key className="mr-2 h-4 w-4" />
              Alterar Senha
            </Button>
          ) : (
            <article className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Alterar Senha</p>
                <button
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordError("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>

              {passwordSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  Senha alterada com sucesso!
                </div>
              )}

              {passwordError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  {passwordError}
                </div>
              )}

              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="Senha atual"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Nova senha"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <Input
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleChangePassword}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Key className="mr-2 h-4 w-4" />
                )}
                Confirmar Alteracao
              </Button>
            </article>
          )}
        </div>

        {/* Botão de logout */}
        <button
          onClick={logout}
          className="w-full rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-600 transition hover:bg-red-100"
        >
          Sair da conta
        </button>
      </div>
    </AppShell>
  );
}
