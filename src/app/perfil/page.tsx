"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import { useMatches, useRanking } from "@/lib/queries";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

export default function PerfilPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const { data: ranking = [], isLoading: rankingLoading } = useRanking();
  const { data: matches = [], isLoading: matchesLoading } = useMatches(user?.id);

  const isLoading = authLoading || rankingLoading;

  // Dados do usuário no ranking
  const userStats = ranking.find((p) => p.id === user?.id);
  const userPosition = ranking.findIndex((p) => p.id === user?.id) + 1;

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
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
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

  const userName = user.name || "Usuário";
  const vitorias = userStats?.vitorias || 0;
  const derrotas = userStats?.derrotas || 0;
  const totalJogos = vitorias + derrotas;
  const winRate = totalJogos > 0 ? Math.round((vitorias / totalJogos) * 100) : 0;

  // Estilos de medalha para top 3
  const medalStyles = {
    1: {
      badge: "bg-gradient-to-br from-yellow-400 to-amber-500",
      border: "border-amber-300",
      bg: "bg-amber-50",
      text: "text-amber-700",
      emoji: "🥇",
    },
    2: {
      badge: "bg-gradient-to-br from-gray-300 to-gray-400",
      border: "border-gray-300",
      bg: "bg-gray-50",
      text: "text-gray-600",
      emoji: "🥈",
    },
    3: {
      badge: "bg-gradient-to-br from-orange-400 to-orange-600",
      border: "border-orange-300",
      bg: "bg-orange-50",
      text: "text-orange-700",
      emoji: "🥉",
    },
  };

  const isTopThree = userPosition > 0 && userPosition <= 3;
  const medal = isTopThree ? medalStyles[userPosition as 1 | 2 | 3] : null;

  return (
    <AppShell title="Perfil" subtitle="Seus dados e estatísticas" showBack>
      <div className="space-y-4">
        {/* Card do perfil */}
        <article className={`space-y-4 rounded-2xl border p-4 shadow-sm ${
          isTopThree && medal ? `${medal.border} ${medal.bg}` : "border-border bg-card"
        }`}>
          <div className="flex items-center gap-4">
            {isTopThree && medal ? (
              <div className={`flex h-14 w-14 items-center justify-center rounded-full ${medal.badge} shadow-lg`}>
                <span className="text-2xl">{medal.emoji}</span>
              </div>
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
                {getInitials(userName)}
              </div>
            )}
            <div className="flex-1">
              <p className={`text-lg font-semibold ${isTopThree && medal ? medal.text : "text-foreground"}`}>
                {userName}
              </p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            {userPosition > 0 && (
              <div className="text-right">
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  isTopThree && medal 
                    ? `${medal.badge} text-white shadow-md` 
                    : "bg-primary/15 text-primary"
                }`}>
                  #{userPosition}
                </span>
              </div>
            )}
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
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
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
                      euVenci ? "text-green-600" : "text-blue-600"
                    }`}
                  >
                    +{meusPoints || (euVenci ? 20 : 8)} pts
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
