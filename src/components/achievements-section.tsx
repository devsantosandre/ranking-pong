"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import {
  useAllAchievements,
  useUserAchievements,
  achievementCategories,
  rarityColors,
  type Achievement,
} from "@/lib/queries/use-achievements";
import { AchievementBadge } from "./achievement-badge";

type AchievementsSectionProps = {
  userId: string;
  compact?: boolean;
};

export function AchievementsSection({ userId, compact = false }: AchievementsSectionProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: allAchievements, isLoading: loadingAll } = useAllAchievements();
  const { data: userAchievements, isLoading: loadingUser } = useUserAchievements(userId);

  const isLoading = loadingAll || loadingUser;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm animate-pulse">
        <div className="h-6 bg-muted rounded w-32 mb-3" />
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-14 w-14 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const unlockedIds = new Set(userAchievements?.map((ua) => ua.achievement_id) || []);
  const unlockedCount = unlockedIds.size;
  const totalCount = allAchievements?.length || 0;

  // Agrupar conquistas por categoria
  const achievementsByCategory: Record<string, Achievement[]> = {};
  for (const achievement of allAchievements || []) {
    if (!achievementsByCategory[achievement.category]) {
      achievementsByCategory[achievement.category] = [];
    }
    achievementsByCategory[achievement.category].push(achievement);
  }

  // Ordenar categorias
  const categoryOrder = [
    "primeiros_passos",
    "vitorias",
    "sequencias",
    "rating",
    "especiais",
    "sociais",
    "veterania",
    "atividade",
    "marcos",
  ];
  const sortedCategories = categoryOrder.filter((c) => achievementsByCategory[c]);

  // Filtrar por categoria selecionada
  const displayCategories = selectedCategory
    ? [selectedCategory]
    : sortedCategories;

  // Buscar data de desbloqueio
  const getUnlockDate = (achievementId: string) => {
    const ua = userAchievements?.find((u) => u.achievement_id === achievementId);
    return ua?.unlocked_at;
  };

  return (
    <article className="rounded-2xl border border-border bg-card shadow-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <span className="font-semibold">Conquistas</span>
          <span className="text-sm text-muted-foreground">
            ({unlockedCount}/{totalCount})
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Barra de progresso */}
      <div className="px-4 pb-2">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
            style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Conteúdo expandido */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Filtros de categoria */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-2 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                selectedCategory === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Todas
            </button>
            {sortedCategories.map((category) => {
              const meta = achievementCategories[category];
              const categoryAchievements = achievementsByCategory[category] || [];
              const categoryUnlocked = categoryAchievements.filter((a) =>
                unlockedIds.has(a.id)
              ).length;

              return (
                <button
                  key={category}
                  onClick={() =>
                    setSelectedCategory(selectedCategory === category ? null : category)
                  }
                  className={`px-2 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {meta?.emoji} {meta?.name} ({categoryUnlocked}/{categoryAchievements.length})
                </button>
              );
            })}
          </div>

          {/* Grid de conquistas por categoria */}
          {displayCategories.map((category) => {
            const meta = achievementCategories[category];
            const categoryAchievements = achievementsByCategory[category] || [];

            return (
              <div key={category}>
                {!selectedCategory && (
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    {meta?.emoji} {meta?.name}
                  </h4>
                )}
                <div className="grid grid-cols-5 gap-2 overflow-visible pb-2">
                  {categoryAchievements.map((achievement) => (
                    <AchievementBadge
                      key={achievement.id}
                      achievement={achievement}
                      unlocked={unlockedIds.has(achievement.id)}
                      unlockedAt={getUnlockDate(achievement.id)}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Estatísticas por raridade */}
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] font-semibold text-muted-foreground mb-2">
              Por raridade
            </p>
            <div className="flex flex-wrap gap-2">
              {(["bronze", "prata", "ouro", "platina", "diamante", "especial"] as const).map(
                (rarity) => {
                  const colors = rarityColors[rarity];
                  const total = (allAchievements || []).filter(
                    (a) => a.rarity === rarity
                  ).length;
                  const unlocked = (allAchievements || []).filter(
                    (a) => a.rarity === rarity && unlockedIds.has(a.id)
                  ).length;

                  if (total === 0) return null;

                  return (
                    <div
                      key={rarity}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium ${colors.bg} ${colors.text} ${colors.border} border`}
                    >
                      {rarity.charAt(0).toUpperCase() + rarity.slice(1)}: {unlocked}/{total}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
