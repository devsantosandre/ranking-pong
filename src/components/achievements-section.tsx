"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import {
  useAllAchievements,
  useUserAchievements,
  achievementCategories,
  rarityColors,
  type Achievement,
  type UserAchievement,
} from "@/lib/queries/use-achievements";
import { AchievementBadge } from "./achievement-badge";

type AchievementsSectionProps = {
  userId: string;
  compact?: boolean;
};

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function getAchievementRequirementText(achievement: Achievement): string {
  const value = achievement.condition_value;

  switch (achievement.condition_type) {
    case "jogos":
      return `Dispute ${formatCount(value, "partida validada", "partidas validadas")}.`;
    case "vitorias":
      return `Alcance ${formatCount(value, "vitoria", "vitorias")}.`;
    case "streak":
      return `Emende ${formatCount(value, "vitoria seguida", "vitorias seguidas")} sem perder.`;
    case "rating":
      return `Chegue a rating ${value} ou mais.`;
    case "posicao":
      return value === 1
        ? "Termine em 1º lugar no ranking."
        : `Fique entre os ${value} primeiros do ranking.`;
    case "perfect":
      return "Venca uma partida por 3x0.";
    case "jogos_dia":
      return `Jogue ${formatCount(value, "partida", "partidas")} no mesmo dia.`;
    case "winrate":
      return `Mantenha ${value}% ou mais de win rate (minimo de 20 jogos).`;
    case "underdog":
      return `Venca um adversario com ${value}+ pontos acima do seu rating.`;
    case "h2h":
      return `Jogue ${formatCount(value, "vez", "vezes")} contra o mesmo adversario.`;
    case "oponentes_unicos":
      return `Enfrente ${formatCount(value, "adversario diferente", "adversarios diferentes")}.`;
    case "dias_escola":
      return value === 0
        ? "Conquista de boas-vindas: conta criada."
        : `Complete ${formatCount(value, "dia", "dias")} desde o cadastro.`;
    case "semanas_consecutivas":
      return `Tenha jogos em ${formatCount(value, "semana consecutiva", "semanas consecutivas")}.`;
    case "meses_ativos":
      return `Tenha jogos em ${formatCount(value, "mes ativo", "meses ativos")} distintos.`;
    case "primeira_semana":
      return "Jogue ao menos 1 partida nos primeiros 7 dias da conta.";
    case "jogos_primeiro_mes":
      return `Dispute ${formatCount(value, "partida", "partidas")} no primeiro mes de conta.`;
    case "retorno":
      return `Jogue novamente apos ${formatCount(value, "dia", "dias")} sem atividade.`;
    default:
      return achievement.description;
  }
}

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

  const unlockedIds = new Set(
    userAchievements?.map((ua: UserAchievement) => ua.achievement_id) || []
  );
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
    const ua = userAchievements?.find((u: UserAchievement) => u.achievement_id === achievementId);
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

                {selectedCategory === category && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      Como desbloquear
                    </p>
                    {categoryAchievements.map((achievement) => {
                      const isUnlocked = unlockedIds.has(achievement.id);

                      return (
                        <article
                          key={`${achievement.id}-guide`}
                          className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2"
                        >
                          <p className="text-xs font-semibold text-foreground">
                            {isUnlocked ? "✅" : "🎯"} {achievement.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {getAchievementRequirementText(achievement)}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
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
