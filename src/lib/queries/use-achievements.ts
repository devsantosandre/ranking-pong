"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "./query-keys";

export type Achievement = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  rarity: "bronze" | "prata" | "ouro" | "platina" | "diamante" | "especial";
  icon: string;
  points: number;
  condition_type: string;
  condition_value: number;
  is_active: boolean;
};

export type UserAchievement = {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  match_id: string | null;
  achievement: Achievement;
};

// Buscar todas as conquistas disponíveis
export function useAllAchievements() {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.achievements.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("condition_value");

      if (error) throw error;
      return data as Achievement[];
    },
    staleTime: 1000 * 60 * 60, // 1 hora (conquistas raramente mudam)
  });
}

// Buscar conquistas desbloqueadas de um usuário
export function useUserAchievements(userId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.achievements.user(userId || ""),
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_achievements")
        .select(`
          id,
          user_id,
          achievement_id,
          unlocked_at,
          match_id,
          achievement:achievements (
            id,
            key,
            name,
            description,
            category,
            rarity,
            icon,
            points,
            condition_type,
            condition_value,
            is_active
          )
        `)
        .eq("user_id", userId)
        .order("unlocked_at", { ascending: false });

      if (error) throw error;

      // Transformar para o formato esperado
      type RawUserAchievement = {
        id: string;
        user_id: string;
        achievement_id: string;
        unlocked_at: string;
        match_id: string | null;
        achievement: Achievement | Achievement[] | null;
      };

      const normalized = (data || []).map((ua: RawUserAchievement) => ({
        ...ua,
        achievement: Array.isArray(ua.achievement) ? ua.achievement[0] : ua.achievement,
      }));

      return normalized.filter(
        (ua: (typeof normalized)[number]): ua is UserAchievement =>
          Boolean(ua.achievement?.is_active)
      );
    },
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 segundos
  });
}

// Buscar contagem de conquistas por categoria
export function useAchievementStats(userId: string | undefined) {
  const { data: allAchievements, isLoading: loadingAll } = useAllAchievements();
  const { data: userAchievements, isLoading: loadingUser } = useUserAchievements(userId);

  const stats = {
    total: allAchievements?.length || 0,
    unlocked: userAchievements?.length || 0,
    byCategory: {} as Record<string, { total: number; unlocked: number }>,
    byRarity: {} as Record<string, { total: number; unlocked: number }>,
    recentUnlocks: [] as UserAchievement[],
  };

  if (allAchievements && userAchievements) {
    const unlockedIds = new Set(
      userAchievements.map((ua: UserAchievement) => ua.achievement_id)
    );

    // Por categoria
    for (const achievement of allAchievements) {
      if (!stats.byCategory[achievement.category]) {
        stats.byCategory[achievement.category] = { total: 0, unlocked: 0 };
      }
      stats.byCategory[achievement.category].total++;
      if (unlockedIds.has(achievement.id)) {
        stats.byCategory[achievement.category].unlocked++;
      }
    }

    // Por raridade
    for (const achievement of allAchievements) {
      if (!stats.byRarity[achievement.rarity]) {
        stats.byRarity[achievement.rarity] = { total: 0, unlocked: 0 };
      }
      stats.byRarity[achievement.rarity].total++;
      if (unlockedIds.has(achievement.id)) {
        stats.byRarity[achievement.rarity].unlocked++;
      }
    }

    // Últimas conquistas (5 mais recentes)
    stats.recentUnlocks = userAchievements.slice(0, 5);
  }

  return {
    stats,
    isLoading: loadingAll || loadingUser,
  };
}

// Categorias de conquistas com metadados
export const achievementCategories: Record<string, { name: string; emoji: string }> = {
  primeiros_passos: { name: "Primeiros Passos", emoji: "🏓" },
  vitorias: { name: "Vitórias", emoji: "🏆" },
  sequencias: { name: "Sequências", emoji: "🔥" },
  rating: { name: "Rating", emoji: "📈" },
  especiais: { name: "Especiais", emoji: "✨" },
  sociais: { name: "Sociais", emoji: "🤝" },
  veterania: { name: "Veterania", emoji: "🏛️" },
  atividade: { name: "Atividade", emoji: "📆" },
  marcos: { name: "Marcos", emoji: "⏰" },
};

// Cores por raridade
export const rarityColors: Record<string, { bg: string; border: string; text: string }> = {
  bronze: { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-700" },
  prata: { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-600" },
  ouro: { bg: "bg-yellow-100", border: "border-yellow-400", text: "text-yellow-700" },
  platina: { bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-700" },
  diamante: { bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-700" },
  especial: { bg: "bg-pink-100", border: "border-pink-300", text: "text-pink-700" },
};
