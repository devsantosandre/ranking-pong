import { GlassCard } from "@/components/arena/glass-card";
import type { TournamentRecap } from "@/lib/tournaments/recap";
import { Trophy, Medal, Swords } from "lucide-react";

function tint(token: string, pct: number) {
  return `color-mix(in srgb, ${token} ${pct}%, transparent)`;
}

/** Chip de set (ex.: 11–8), orientado com o campeão à esquerda. */
function SetChips({ sets }: { sets: Array<[number, number]> | null }) {
  if (!sets || sets.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {sets.map((s, i) => {
        const champWon = s[0] > s[1];
        return (
          <span
            key={i}
            className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
            style={{
              background: tint(champWon ? "var(--state-played)" : "var(--state-noshow)", 12),
              color: champWon ? "var(--state-played)" : "var(--state-noshow)",
            }}
          >
            {s[0]}–{s[1]}
          </span>
        );
      })}
    </div>
  );
}

/** Pódio com campeão em destaque, vice e terceiros colocados. */
export function TournamentPodium({ recap }: { recap: TournamentRecap }) {
  const { champion, runnerUp, semifinalists, thirdPlace, fourthPlace, finalChampionScore, finalOpponentScore, finalSets } =
    recap;
  if (!champion) return null;

  return (
    <GlassCard variant="elevated" className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 0%, color-mix(in srgb,var(--state-scheduled) 14%,transparent) 0%, transparent 65%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col items-center gap-3 text-center">
        {/* Campeão */}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: tint("var(--state-scheduled)", 16),
            border: `1px solid ${tint("var(--state-scheduled)", 35)}`,
          }}
        >
          <Trophy className="h-8 w-8" style={{ color: "var(--state-scheduled)" }} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-(--state-scheduled)">
            Campeão
          </p>
          <p
            className="mt-0.5 text-xl font-bold text-(--arena-foreground)"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {champion.flag && (
              <span className={`fi fi-${champion.flag.toLowerCase()} mr-1.5 align-middle`} aria-hidden />
            )}
            {champion.name}
          </p>
        </div>

        {/* Placar da final */}
        {runnerUp && finalChampionScore != null && finalOpponentScore != null && (
          <div className="w-full max-w-xs space-y-1.5">
            <div className="flex items-center justify-center gap-3">
              <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-(--arena-foreground)">
                {champion.name}
              </span>
              <span
                className="shrink-0 rounded-lg px-2.5 py-1 text-base font-bold tabular-nums text-(--arena-foreground)"
                style={{ background: tint("var(--arena-foreground)", 8), fontFamily: "var(--font-display)" }}
              >
                {finalChampionScore}–{finalOpponentScore}
              </span>
              <span className="min-w-0 flex-1 truncate text-left text-sm text-(--arena-muted)">
                {runnerUp.name}
              </span>
            </div>
            <SetChips sets={finalSets} />
            <p className="text-[10px] uppercase tracking-widest text-(--arena-muted)">na final</p>
          </div>
        )}

        {/* Pódio: vice + 3º lugar */}
        <div className="flex w-full flex-wrap items-center justify-center gap-1.5 pt-1">
          {runnerUp && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: tint("var(--state-tbd)", 14), color: "var(--arena-foreground)" }}
            >
              <Medal className="h-3 w-3" style={{ color: "var(--state-tbd)" }} />
              Vice · {runnerUp.name}
            </span>
          )}
          {thirdPlace ? (
            // Disputa de 3º jogada: um único 3º em destaque (subiu no pódio).
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: tint("var(--state-played)", 14), color: "var(--arena-foreground)" }}
            >
              <Medal className="h-3 w-3" style={{ color: "var(--state-played)" }} />
              3º · {thirdPlace.name}
            </span>
          ) : (
            // Sem disputa: os dois semifinalistas são 3º empatado.
            semifinalists.map((s) => (
              <span
                key={s.participantId}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ background: tint("var(--state-played)", 12), color: "var(--arena-foreground)" }}
              >
                <Medal className="h-3 w-3" style={{ color: "var(--state-played)" }} /> 3º · {s.name}
              </span>
            ))
          )}
        </div>

        {/* 4º lugar: fora do pódio, discreto */}
        {fourthPlace && (
          <p className="text-[10px] uppercase tracking-widest text-(--arena-muted)">
            4º · {fourthPlace.name}
          </p>
        )}
      </div>
    </GlassCard>
  );
}

/** Campanha do campeão: cada partida até o título. */
export function ChampionCampaign({ recap }: { recap: TournamentRecap }) {
  if (recap.championPath.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
        Campanha do campeão
      </p>
      {recap.championPath.map((step, i) => {
        const isFinal = i === recap.championPath.length - 1;
        return (
          <GlassCard
            key={step.matchId}
            noPadding
            className="flex items-center gap-3 px-3 py-3"
            glow={isFinal ? "scheduled" : "none"}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: tint(isFinal ? "var(--state-scheduled)" : "var(--arena-primary)", 14),
              }}
            >
              {isFinal ? (
                <Trophy className="h-5 w-5" style={{ color: "var(--state-scheduled)" }} />
              ) : (
                <Swords className="h-5 w-5" style={{ color: "var(--arena-primary)" }} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-(--arena-muted)">
                {step.roundLabel}
              </p>
              <p className="truncate text-sm font-semibold text-(--arena-foreground)">
                vs {step.opponentName}
              </p>
              {step.championSets && step.championSets.length > 0 && (
                <div className="mt-1">
                  <SetChips sets={step.championSets} />
                </div>
              )}
            </div>
            <p
              className="shrink-0 text-lg font-bold tabular-nums"
              style={{ color: "var(--state-played)", fontFamily: "var(--font-display)" }}
            >
              {step.championScore}–{step.opponentScore}
            </p>
          </GlassCard>
        );
      })}
    </div>
  );
}
