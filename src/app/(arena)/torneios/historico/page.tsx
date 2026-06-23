import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import { getTournamentRecap } from "@/lib/tournaments/recap";
import { FORMAT_META } from "@/lib/tournaments/format-meta";
import type { TournamentDetail } from "@/lib/tournaments/types";
import Link from "next/link";
import { Trophy, Medal, Users, ChevronRight, History } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function HistoricoTorneiosPage() {
  const repo = await getTournamentRepo();
  const all = await repo.listTournaments();
  const finished = all
    .filter((t) => t.status === "finished")
    .sort(
      (a, b) =>
        new Date(b.finishedAt ?? b.createdAt).getTime() -
        new Date(a.finishedAt ?? a.createdAt).getTime(),
    );

  const details = (
    await Promise.all(finished.map((t) => repo.getTournament(t.id)))
  ).filter((d): d is TournamentDetail => d !== null);

  return (
    <ArenaShell title="Histórico de torneios" subtitle="Campeões e finais" showBack>
      <div className="flex flex-col gap-2">
        {details.length === 0 ? (
          <GlassCard className="flex flex-col items-center gap-4 py-12 text-center">
            <History className="h-10 w-10 text-(--arena-muted)" />
            <div>
              <p className="text-sm font-semibold text-(--arena-foreground)">
                Nenhum torneio encerrado ainda
              </p>
              <p className="mt-1 text-xs text-(--arena-muted)">
                Quando um torneio terminar, o resumo aparece aqui.
              </p>
            </div>
          </GlassCard>
        ) : (
          details.map((detail) => {
            const recap = getTournamentRecap(detail);
            const meta = FORMAT_META[detail.format];
            return (
              <Link key={detail.id} href={`/torneios/${detail.id}`}>
                <GlassCard
                  noPadding
                  className="group overflow-hidden transition-all hover:scale-[1.01] hover:bg-(--glass-bg-hover)"
                >
                  {/* Cabeçalho do torneio */}
                  <div className="flex items-center gap-3 px-4 pt-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "color-mix(in srgb,var(--arena-primary) 14%,transparent)" }}
                    >
                      <Trophy className="h-5 w-5" style={{ color: "var(--arena-primary)" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-(--arena-foreground)">
                        {detail.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-(--arena-muted)">
                        <span>{meta.full}</span>
                        {recap.finishedAt && <span>· {formatDate(recap.finishedAt)}</span>}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-(--arena-muted) transition group-hover:translate-x-0.5" />
                  </div>

                  {/* Faixa do campeão */}
                  {recap.champion && (
                    <div
                      className="mt-3 flex items-center gap-3 px-4 py-2.5"
                      style={{
                        background: "color-mix(in srgb,var(--state-scheduled) 8%,transparent)",
                        borderTop: "1px solid color-mix(in srgb,var(--state-scheduled) 18%,transparent)",
                      }}
                    >
                      <Trophy className="h-4 w-4 shrink-0" style={{ color: "var(--state-scheduled)" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-(--state-scheduled)">
                          Campeão
                        </p>
                        <p className="truncate text-sm font-bold text-(--arena-foreground)">
                          {recap.champion.flag && (
                            <span className={`fi fi-${recap.champion.flag.toLowerCase()} mr-1.5 align-middle`} aria-hidden />
                          )}
                          {recap.champion.name}
                        </p>
                      </div>
                      {recap.finalChampionScore != null && recap.finalOpponentScore != null && (
                        <span
                          className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold tabular-nums text-(--arena-foreground)"
                          style={{ background: "color-mix(in srgb,var(--arena-foreground) 8%,transparent)", fontFamily: "var(--font-display)" }}
                        >
                          {recap.finalChampionScore}–{recap.finalOpponentScore}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Rodapé: vice + nº de jogadores */}
                  <div className="flex items-center gap-3 px-4 py-2.5 text-[11px] text-(--arena-muted)">
                    {recap.runnerUp && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Medal className="h-3 w-3 shrink-0" style={{ color: "var(--state-tbd)" }} />
                        <span className="truncate">Vice: {recap.runnerUp.name}</span>
                      </span>
                    )}
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1">
                      <Users className="h-3 w-3" />
                      {recap.participantCount} jogadores
                    </span>
                  </div>
                </GlassCard>
              </Link>
            );
          })
        )}
      </div>
    </ArenaShell>
  );
}
