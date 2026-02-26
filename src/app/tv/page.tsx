"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Suspense, useCallback, useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { NetworkStatusLayer } from "@/components/network-status-layer";
import { useRealtimeRanking, type RankingPlayerWithPosition } from "@/lib/hooks/use-realtime-ranking";
import { useLatestValidatedMatch } from "@/lib/hooks/use-latest-validated-match";
import { TvRankingList } from "@/components/tv/tv-ranking-list";
import { LayoutGrid, List, Volume2, VolumeX } from "lucide-react";
import { buildBrowserTitle } from "@/lib/app-title";

function TvRankingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const viewMode = (searchParams.get("view") || "grid") as "grid" | "table";
  const demoMode = searchParams.get("demo") === "true";

  const { data: players, isLoading, error, dataUpdatedAt } = useRealtimeRanking(limit);
  const { data: latestMatch } = useLatestValidatedMatch();

  // Estado para simulação de troca de posições
  const [simulatedPlayers, setSimulatedPlayers] = useState<RankingPlayerWithPosition[] | null>(null);
  const initializeSimulatedPlayers = useCallback((basePlayers: RankingPlayerWithPosition[]) => {
    setSimulatedPlayers([...basePlayers]);
  }, []);

  // Estado para som
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Simulação: troca posições aleatórias a cada 5 segundos
  useEffect(() => {
    if (!demoMode || !players || players.length < 2) {
      return;
    }

    // Inicializa com os players reais (assíncrono para evitar cascata de render no effect)
    const initialSyncTimer = setTimeout(() => {
      initializeSimulatedPlayers(players);
    }, 0);

    const interval = setInterval(() => {
      setSimulatedPlayers((current) => {
        if (!current || current.length < 2) return current;

        const newPlayers = [...current];

        // Escolhe dois índices aleatórios para trocar
        const idx1 = Math.floor(Math.random() * Math.min(10, newPlayers.length));
        const idx2 = Math.floor(Math.random() * Math.min(10, newPlayers.length));

        if (idx1 !== idx2) {
          // Troca os jogadores
          const temp = newPlayers[idx1];
          newPlayers[idx1] = newPlayers[idx2];
          newPlayers[idx2] = temp;

          // Recalcula as posições
          return newPlayers.map((player, index) => ({
            ...player,
            position: index + 1,
          }));
        }

        return current;
      });
    }, 5000);

    return () => {
      clearTimeout(initialSyncTimer);
      clearInterval(interval);
    };
  }, [demoMode, players, initializeSimulatedPlayers]);

  // Usa players simulados no modo demo, senão usa os reais
  const displayPlayers =
    demoMode && players && players.length >= 2 && simulatedPlayers ? simulatedPlayers : players;

  useEffect(() => {
    document.title = buildBrowserTitle(demoMode ? "TV Demo" : "TV ao vivo");
  }, [demoMode]);

  const toggleViewMode = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", viewMode === "grid" ? "table" : "grid");
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, viewMode, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-muted-foreground text-xs sm:text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center text-red-500 p-4">
          <p className="text-sm sm:text-lg font-bold mb-1">Erro ao carregar</p>
          <p className="text-xs sm:text-sm">Recarregue a página</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header responsivo */}
      <header className="flex-shrink-0 bg-background/95 backdrop-blur border-b border-border/50 px-2 sm:px-4 lg:px-6 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-xl lg:text-2xl font-bold text-foreground truncate">
              Smash Pong App
              {demoMode ? (
                <span className="ml-2 text-xs font-normal text-orange-500 animate-pulse">
                  DEMO
                </span>
              ) : (
                <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-500">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  AO VIVO
                </span>
              )}
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {displayPlayers?.length || 0} jogadores
              <span className="hidden sm:inline">
                {" · "}
                {new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {demoMode && <span className="text-orange-500"> · Troca a cada 5s</span>}
            </p>
            {!demoMode && latestMatch ? (
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                Última partida: {latestMatch.playerAName} {latestMatch.score} {latestMatch.playerBName}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Sound */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg border transition-colors ${
                soundEnabled
                  ? "border-green-500/50 bg-green-500/10 hover:bg-green-500/20"
                  : "border-border/50 bg-card/50 hover:bg-muted/50"
              }`}
              title={soundEnabled ? "Desativar som" : "Ativar som"}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-green-600" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {/* Toggle View Mode */}
            <button
              onClick={toggleViewMode}
              className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-border/50 bg-card/50 hover:bg-muted/50 transition-colors"
              title={viewMode === "grid" ? "Mudar para tabela" : "Mudar para grid"}
            >
              {viewMode === "grid" ? (
                <>
                  <List className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Tabela</span>
                </>
              ) : (
                <>
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Grid</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Lista de jogadores */}
      <main className="flex-1 overflow-auto p-2 sm:p-3 lg:p-4">
        {displayPlayers && displayPlayers.length > 0 ? (
          <TvRankingList
            players={displayPlayers}
            viewMode={viewMode}
            soundEnabled={soundEnabled}
            focusPlayerIds={
              !demoMode
                ? latestMatch
                  ? [latestMatch.playerAId, latestMatch.playerBId]
                  : []
                : undefined
            }
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-center text-muted-foreground text-sm">
              Nenhum jogador no ranking
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function TvPage() {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <NetworkStatusLayer />
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen bg-background">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        }
      >
        <TvRankingContent />
      </Suspense>
    </QueryClientProvider>
  );
}
