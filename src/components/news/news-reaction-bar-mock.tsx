"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  type ReactionCounts,
  type ReactionPeople,
  type ReactionType,
  useMatchReactionPeople,
  useToggleMatchReaction,
} from "@/lib/queries/use-news";

type ReactionOption = {
  key: ReactionType;
  emoji: string;
  label: string;
};

export type NewsReactionOverlayPanel = "picker" | "who";

const REACTION_OPTIONS: ReactionOption[] = [
  { key: "clap", emoji: "👏", label: "Mandou bem" },
  { key: "fire", emoji: "🔥", label: "Insano" },
  { key: "wow", emoji: "😮", label: "Surpresa" },
  { key: "laugh", emoji: "😂", label: "Engraçado" },
  { key: "sad", emoji: "😢", label: "Quase" },
  { key: "pong", emoji: "🏓", label: "Raiz" },
];

function createEmptyReactionPeople(): ReactionPeople {
  return {
    clap: [],
    fire: [],
    wow: [],
    laugh: [],
    sad: [],
    pong: [],
  };
}

function formatReactionWord(count: number) {
  return `${count} ${count === 1 ? "reação" : "reações"}`;
}

function formatCompactPersonName(name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return "Jogador";
  if (clean === "Você") return clean;

  const parts = clean.split(" ");
  if (parts.length <= 2) return clean;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function NewsReactionBarMock({
  matchId,
  userId,
  reactionCounts,
  reactionsTotal,
  myReaction,
  openPanel,
  onOpenPanelChange,
}: {
  matchId: string;
  userId?: string;
  reactionCounts: ReactionCounts;
  reactionsTotal: number;
  myReaction: ReactionType | null;
  openPanel: NewsReactionOverlayPanel | null;
  onOpenPanelChange: (panel: NewsReactionOverlayPanel | null) => void;
}) {
  const showPicker = openPanel === "picker";
  const showWhoReacted = openPanel === "who";
  const toggleReactionMutation = useToggleMatchReaction(userId);

  const { data: reactionPeopleData, isLoading: isLoadingReactionPeople } =
    useMatchReactionPeople(matchId, showWhoReacted);

  const reactionTotals = useMemo(() => {
    return REACTION_OPTIONS.map((reaction) => ({
      ...reaction,
      count: reactionCounts[reaction.key] ?? 0,
    }))
      .filter((reaction) => reaction.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [reactionCounts]);

  const activeReaction = useMemo(
    () => REACTION_OPTIONS.find((reaction) => reaction.key === myReaction) ?? null,
    [myReaction]
  );

  const topReactions = reactionTotals.slice(0, 3);

  const peopleByReaction = useMemo(() => {
    const base = reactionPeopleData ?? createEmptyReactionPeople();
    const merged: ReactionPeople = {
      clap: [...base.clap],
      fire: [...base.fire],
      wow: [...base.wow],
      laugh: [...base.laugh],
      sad: [...base.sad],
      pong: [...base.pong],
    };

    if (myReaction && !merged[myReaction].includes("Você")) {
      merged[myReaction] = ["Você", ...merged[myReaction]];
    }

    return merged;
  }, [myReaction, reactionPeopleData]);

  const togglePicker = () => {
    onOpenPanelChange(showPicker ? null : "picker");
  };

  const toggleWhoReacted = () => {
    if (reactionTotals.length === 0) return;
    onOpenPanelChange(showWhoReacted ? null : "who");
  };

  const handleReactionClick = (reaction: ReactionType) => {
    if (!userId || toggleReactionMutation.isPending) return;

    toggleReactionMutation.mutate({
      matchId,
      reaction,
      currentReaction: myReaction,
    });

    onOpenPanelChange(null);
  };

  return (
    <section className="relative flex items-center justify-end gap-1.5 pt-1">
      {reactionTotals.length > 0 ? (
        <button
          type="button"
          onClick={toggleWhoReacted}
          className={cn(
            "inline-flex h-7.5 max-w-[52%] items-center gap-1.5 rounded-full border border-border bg-card/95 px-2 text-[11px] text-muted-foreground shadow-sm transition",
            showWhoReacted && "border-primary/35 text-primary"
          )}
          aria-label="Ver quem reagiu"
        >
          <span className="flex items-center -space-x-1">
            {topReactions.map((reaction) => (
              <span
                key={`summary-${reaction.key}`}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-card bg-card text-[9px]"
              >
                {reaction.emoji}
              </span>
            ))}
          </span>
          <span className="truncate">{formatReactionWord(reactionsTotal)}</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={togglePicker}
        className={cn(
          "inline-flex h-8 items-center rounded-full border bg-card px-2.5 text-[11px] font-semibold text-primary shadow-sm transition hover:scale-[1.02]",
          activeReaction && "gap-1",
          activeReaction ? "border-primary/50 bg-primary/10" : "border-primary/35"
        )}
        aria-label="Abrir seletor de reações"
      >
        {activeReaction ? (
          <span className="text-xs leading-none">{activeReaction.emoji}</span>
        ) : null}
        <span>{activeReaction ? activeReaction.label : "Reagir"}</span>
      </button>

      {showPicker ? (
        <div className="absolute bottom-12 right-0 z-20 rounded-full border border-border/70 bg-card p-1.5 shadow-xl">
          <div className="flex items-center justify-between gap-1">
            {REACTION_OPTIONS.map((reaction) => {
              const count = reactionCounts[reaction.key] ?? 0;
              const isSelected = myReaction === reaction.key;

              return (
                <button
                  key={reaction.key}
                  type="button"
                  onClick={() => handleReactionClick(reaction.key)}
                  disabled={toggleReactionMutation.isPending}
                  className={cn(
                    "group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-70",
                    isSelected && "bg-primary/10 ring-1 ring-primary/40"
                  )}
                  aria-label={reaction.label}
                  title={`${reaction.label} (${formatReactionWord(count)})`}
                >
                  <span className="leading-none">{reaction.emoji}</span>
                  <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-background opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    {reaction.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <Sheet
        open={showWhoReacted && reactionTotals.length > 0}
        onOpenChange={(open) => onOpenPanelChange(open ? "who" : null)}
      >
        <SheetContent
          side="bottom"
          className="max-h-[75vh] rounded-t-3xl border-t border-border bg-background p-0"
        >
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-border" />
          <SheetHeader className="pb-2">
            <SheetTitle>Quem reagiu</SheetTitle>
            <SheetDescription>{formatReactionWord(reactionsTotal)} nesta partida.</SheetDescription>
          </SheetHeader>

          <div className="space-y-2 overflow-y-auto px-4 pb-5">
            {isLoadingReactionPeople ? (
              <p className="text-sm text-muted-foreground">Carregando reações...</p>
            ) : reactionTotals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma reação registrada ainda.</p>
            ) : (
              reactionTotals.map((reaction) => {
                const names = peopleByReaction[reaction.key].slice(0, reaction.count);
                return (
                  <div
                    key={`who-${reaction.key}`}
                    className="rounded-xl border border-border/70 bg-card p-2"
                  >
                    <p className="mb-1 text-xs font-semibold text-foreground">
                      {reaction.emoji} {reaction.label} ({reaction.count})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {names.length > 0 ? (
                        names.map((name, index) => (
                          <span
                            key={`${reaction.key}-${name}-${index}`}
                            className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground"
                            title={name}
                          >
                            {formatCompactPersonName(name)}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Sem nomes para esta reação.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
