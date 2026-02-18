"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import { useMatches, useUser, useUserRankingPosition } from "@/lib/queries";
import {
  BookOpen,
  Settings,
} from "lucide-react";
import { useMemo } from "react";
import Link from "next/link";
import { ProfilePageSkeleton, MatchListSkeleton } from "@/components/skeletons";
import {
  getPlayerStyle,
  getDivisionName,
  getDivisionNumber,
  isTopThree,
} from "@/lib/divisions";
import { AchievementsSection } from "@/components/achievements-section";

export default function PerfilPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const { data: userStats, isLoading: userStatsLoading } = useUser(user?.id);
  const { data: rankingPosition, isLoading: rankingPositionLoading } = useUserRankingPosition(user?.id);
  const { data: matchesData, isLoading: matchesLoading } = useMatches(user?.id);

  const matches = useMemo(() => {
    return matchesData?.pages.flatMap((page) => page.matches) ?? [];
  }, [matchesData]);

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

        <Link
          href="/perfil/configuracoes"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary"
        >
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold text-foreground">Configurações e Segurança</p>
              <p className="text-xs text-muted-foreground">
                Notificações, senha e preferências
              </p>
            </div>
          </div>
          <span className="text-muted-foreground">→</span>
        </Link>

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
