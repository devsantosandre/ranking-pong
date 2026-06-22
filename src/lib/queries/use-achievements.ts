"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { markAchievementToastsSeenAction } from "@/app/actions/achievements";
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
  toast_seen_at: string | null;
  match_id: string | null;
  achievement: Achievement;
};

type RawUserAchievement = {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  toast_seen_at: string | null;
  match_id: string | null;
  achievement: Achievement | Achievement[] | null;
};

function normalizeUserAchievements(data: RawUserAchievement[] | null | undefined) {
  const normalized = (data || []).map((ua) => ({
    ...ua,
    achievement: Array.isArray(ua.achievement) ? ua.achievement[0] : ua.achievement,
  }));

  return normalized.filter(
    (ua: (typeof normalized)[number]): ua is UserAchievement =>
      Boolean(ua.achievement?.is_active)
  );
}

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
          toast_seen_at,
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
      return normalizeUserAchievements(data as RawUserAchievement[]);
    },
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 segundos
  });
}

// Buscar conquistas desbloqueadas que ainda nao foram exibidas na modal
export function usePendingAchievementToasts(userId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.achievements.pendingToasts(userId || ""),
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_achievements")
        .select(`
          id,
          user_id,
          achievement_id,
          unlocked_at,
          toast_seen_at,
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
        .is("toast_seen_at", null)
        .order("unlocked_at", { ascending: true });

      if (error) throw error;
      return normalizeUserAchievements(data as RawUserAchievement[]);
    },
    enabled: !!userId,
    staleTime: 1000 * 5,
  });
}

export function useMarkAchievementToastsSeen(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userAchievementIds: string[]) => {
      const result = await markAchievementToastsSeenAction(userAchievementIds);
      if (!result.success) {
        throw new Error(result.error || "Erro ao marcar conquistas como visualizadas");
      }
      return result;
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.achievements.pendingToasts(userId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.achievements.user(userId),
        });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all });
      }
    },
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

// Cores por raridade — tokens temáveis (white-label + dark)
export const rarityColors: Record<string, { bg: string; border: string; text: string }> = {
  bronze: { bg: "bg-(--state-scheduled)/15", border: "border-(--state-scheduled)/30", text: "text-(--state-scheduled)" },
  prata: { bg: "bg-(--state-tbd)/15", border: "border-(--state-tbd)/30", text: "text-(--state-tbd)" },
  ouro: { bg: "bg-(--state-scheduled)/15", border: "border-(--state-scheduled)/40", text: "text-(--state-scheduled)" },
  platina: { bg: "bg-(--state-active)/15", border: "border-(--state-active)/30", text: "text-(--state-active)" },
  diamante: { bg: "bg-(--arena-primary)/15", border: "border-(--arena-primary)/30", text: "text-(--arena-primary)" },
  especial: { bg: "bg-(--state-noshow)/15", border: "border-(--state-noshow)/30", text: "text-(--state-noshow)" },
};
