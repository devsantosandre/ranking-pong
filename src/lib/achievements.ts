// Sistema de Conquistas/Medalhas
// Verifica e desbloqueia conquistas baseado em stats e eventos

import { hasAdminConfig } from "@/lib/env";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

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

export type AchievementContext = {
  userId: string;
  matchId?: string;
  // Stats do usuário
  vitorias: number;
  derrotas: number;
  jogos: number;
  rating: number;
  streak: number;
  // Contexto da partida (se aplicável)
  isWinner?: boolean;
  opponentRating?: number;
  resultado?: string; // "3x0", "3x1", etc.
};

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ValidatedMatch = {
  player_a_id: string;
  player_b_id: string;
  created_at: string;
  vencedor_id: string | null;
};

type AchievementEvaluationCache = {
  validatedMatchesPromise?: Promise<ValidatedMatch[]>;
  userCreatedAtPromise?: Promise<string | null>;
  matchesInCurrentDayCountPromise?: Promise<number>;
  rankingIdsByLimit: Map<number, Promise<string[]>>;
  conditionResultByKey: Map<string, Promise<boolean>>;
};

const ACTIVE_ACHIEVEMENTS_CACHE_TTL_MS = 30_000;
let cachedActiveAchievements: { data: Achievement[]; fetchedAt: number } | null = null;

async function getAchievementsSupabaseClient(): Promise<ServerSupabaseClient> {
  if (hasAdminConfig()) {
    // Service role evita erro de RLS ao desbloquear conquistas para o outro jogador.
    return createAdminClient() as unknown as ServerSupabaseClient;
  }

  return createClient();
}

async function getActiveAchievements(
  supabase: ServerSupabaseClient
): Promise<Achievement[]> {
  const now = Date.now();
  if (cachedActiveAchievements && now - cachedActiveAchievements.fetchedAt < ACTIVE_ACHIEVEMENTS_CACHE_TTL_MS) {
    return cachedActiveAchievements.data;
  }

  const { data: achievements, error } = await supabase
    .from("achievements")
    .select("*")
    .eq("is_active", true);

  if (error || !achievements) {
    return [];
  }

  const normalized = achievements as Achievement[];
  cachedActiveAchievements = { data: normalized, fetchedAt: now };
  return normalized;
}

// Verifica conquistas e retorna as que foram desbloqueadas
// IMPORTANTE: Esta função NUNCA deve lançar exceções para não quebrar a confirmação de partida
export async function checkAndUnlockAchievements(
  context: AchievementContext
): Promise<Achievement[]> {
  try {
    const supabase = await getAchievementsSupabaseClient();
    const unlockedAchievements: Achievement[] = [];

    // 1. Buscar todas as conquistas ativas (com cache curto)
    const allAchievements = await getActiveAchievements(supabase);
    if (allAchievements.length === 0) {
      return [];
    }

    // 2. Buscar conquistas já desbloqueadas pelo usuário
    const { data: userAchievements, error: userAchievementsError } = await supabase
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", context.userId);

    if (userAchievementsError) {
      return [];
    }

    const unlockedIds = new Set(userAchievements?.map((ua) => ua.achievement_id) || []);
    const evaluationCache: AchievementEvaluationCache = {
      rankingIdsByLimit: new Map(),
      conditionResultByKey: new Map(),
    };

    // 3. Verificar cada conquista não desbloqueada
    for (const achievement of allAchievements) {
      if (unlockedIds.has(achievement.id)) continue;

      const conditionCacheKey = `${achievement.condition_type}:${achievement.condition_value}`;
      if (!evaluationCache.conditionResultByKey.has(conditionCacheKey)) {
        evaluationCache.conditionResultByKey.set(
          conditionCacheKey,
          checkAchievementCondition(achievement, context, supabase, evaluationCache)
        );
      }
      const shouldUnlock = await evaluationCache.conditionResultByKey.get(conditionCacheKey)!;

      if (shouldUnlock) {
        // Desbloquear conquista usando upsert para evitar erros de duplicação
        // onConflict ignora silenciosamente se já existe (race condition safe)
        const { error: insertError } = await supabase
          .from("user_achievements")
          .upsert(
            {
              user_id: context.userId,
              achievement_id: achievement.id,
              match_id: context.matchId || null,
            },
            {
              onConflict: "user_id,achievement_id",
              ignoreDuplicates: true,
            }
          );

        if (!insertError) {
          unlockedAchievements.push(achievement as Achievement);
          unlockedIds.add(achievement.id);
        }
      }
    }

    return unlockedAchievements;
  } catch {
    // Retorna array vazio para não quebrar a confirmação de partida
    return [];
  }
}

// Verifica se uma condição específica de conquista foi atingida
async function checkAchievementCondition(
  achievement: Achievement,
  context: AchievementContext,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<boolean> {
  const { condition_type, condition_value } = achievement;

  switch (condition_type) {
    // Conquistas baseadas em contagem
    case "jogos":
      return context.jogos >= condition_value;

    case "vitorias":
      return context.vitorias >= condition_value;

    case "streak":
      return context.streak >= condition_value;

    case "rating":
      return context.rating >= condition_value;

    // Conquistas de posição no ranking
    case "posicao":
      return checkRankingPosition(context.userId, condition_value, supabase, cache);

    // Conquistas especiais de partida
    case "underdog":
      if (!context.isWinner || !context.opponentRating) return false;
      return (context.opponentRating - context.rating) >= condition_value;

    case "perfect":
      return context.isWinner === true && context.resultado === "3x0";

    case "winrate":
      if (context.jogos < 20) return false;
      const winRate = (context.vitorias / Math.max(context.jogos, 1)) * 100;
      return winRate >= condition_value;

    case "jogos_dia":
      return checkMatchesInDay(context.userId, condition_value, supabase, cache);

    // Conquistas sociais
    case "h2h":
      return checkHeadToHead(context.userId, condition_value, supabase, cache);

    case "oponentes_unicos":
      return checkUniqueOpponents(context.userId, condition_value, supabase, cache);

    // Conquistas de veterania
    case "dias_escola":
      return checkDaysInSchool(context.userId, condition_value, supabase, cache);

    // Conquistas de atividade
    case "semanas_consecutivas":
      return checkConsecutiveWeeks(context.userId, condition_value, supabase, cache);

    case "meses_ativos":
      return checkActiveMonths(context.userId, condition_value, supabase, cache);

    // Marcos temporais
    case "primeira_semana":
      return checkFirstWeekActivity(context.userId, supabase, cache);

    case "jogos_primeiro_mes":
      return checkFirstMonthMatches(context.userId, condition_value, supabase, cache);

    case "retorno":
      return checkComeback(context.userId, condition_value, supabase, cache);

    default:
      return false;
  }
}

// Helpers para verificações complexas

async function getValidatedMatchesForUser(
  userId: string,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<ValidatedMatch[]> {
  if (!cache.validatedMatchesPromise) {
    cache.validatedMatchesPromise = (async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("player_a_id, player_b_id, created_at, vencedor_id")
        .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
        .eq("status", "validado")
        .order("created_at", { ascending: false });

      if (error || !data) return [];
      return data as ValidatedMatch[];
    })();
  }

  return cache.validatedMatchesPromise;
}

async function getUserCreatedAt(
  userId: string,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<string | null> {
  if (!cache.userCreatedAtPromise) {
    cache.userCreatedAtPromise = (async () => {
      const { data: user, error } = await supabase
        .from("users")
        .select("created_at")
        .eq("id", userId)
        .single();

      if (error || !user?.created_at) return null;
      return user.created_at as string;
    })();
  }

  return cache.userCreatedAtPromise;
}

async function getRankingUserIdsByLimit(
  maxPosition: number,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<string[]> {
  if (maxPosition <= 0) return [];
  if (!cache.rankingIdsByLimit.has(maxPosition)) {
    const rankingPromise = (async () => {
      const { data: users, error } = await supabase
        .from("users")
        .select("id")
        .eq("is_active", true)
        .eq("hide_from_ranking", false)
        .order("rating_atual", { ascending: false })
        .limit(maxPosition);

      if (error || !users) return [];
      return users.map((u) => u.id as string);
    })();
    cache.rankingIdsByLimit.set(maxPosition, rankingPromise);
  }

  return cache.rankingIdsByLimit.get(maxPosition)!;
}

async function getMatchesInCurrentDayCount(
  userId: string,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<number> {
  if (!cache.matchesInCurrentDayCountPromise) {
    cache.matchesInCurrentDayCountPromise = (async () => {
      const today = new Date().toISOString().split("T")[0];
      const { count, error } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
        .eq("status", "validado")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      if (error) return 0;
      return count || 0;
    })();
  }

  return cache.matchesInCurrentDayCountPromise;
}

async function checkRankingPosition(
  userId: string,
  maxPosition: number,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<boolean> {
  const rankingUserIds = await getRankingUserIdsByLimit(maxPosition, supabase, cache);
  const userPositionIndex = rankingUserIds.indexOf(userId);
  return userPositionIndex !== -1 && userPositionIndex < maxPosition;
}

async function checkMatchesInDay(
  userId: string,
  minMatches: number,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<boolean> {
  const matchesCount = await getMatchesInCurrentDayCount(userId, supabase, cache);
  return matchesCount >= minMatches;
}

async function checkHeadToHead(
  userId: string,
  minMatches: number,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<boolean> {
  const matches = await getValidatedMatchesForUser(userId, supabase, cache);
  if (matches.length === 0) return false;

  const opponentCounts: Record<string, number> = {};
  for (const match of matches) {
    const opponentId = match.player_a_id === userId ? match.player_b_id : match.player_a_id;
    opponentCounts[opponentId] = (opponentCounts[opponentId] || 0) + 1;
  }

  return Object.values(opponentCounts).some((count) => count >= minMatches);
}

async function checkUniqueOpponents(
  userId: string,
  minOpponents: number,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<boolean> {
  const matches = await getValidatedMatchesForUser(userId, supabase, cache);
  if (matches.length === 0) return false;

  const opponents = new Set<string>();
  for (const match of matches) {
    const opponentId = match.player_a_id === userId ? match.player_b_id : match.player_a_id;
    opponents.add(opponentId);
  }

  return opponents.size >= minOpponents;
}

async function checkDaysInSchool(
  userId: string,
  minDays: number,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<boolean> {
  const userCreatedAt = await getUserCreatedAt(userId, supabase, cache);
  if (!userCreatedAt) return false;

  const createdAt = new Date(userCreatedAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  return diffDays >= minDays;
}

async function checkConsecutiveWeeks(
  userId: string,
  minWeeks: number,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<boolean> {
  const matches = await getValidatedMatchesForUser(userId, supabase, cache);
  if (matches.length === 0) return false;

  // Agrupar por semana ISO
  const weeks = new Set<string>();
  for (const match of matches) {
    const date = new Date(match.created_at);
    const week = getISOWeek(date);
    weeks.add(week);
  }

  // Verificar semanas consecutivas a partir da atual
  const sortedWeeks = Array.from(weeks).sort().reverse();
  let consecutive = 0;
  let expectedWeek = getCurrentISOWeek();

  for (const week of sortedWeeks) {
    if (week === expectedWeek) {
      consecutive++;
      expectedWeek = getPreviousISOWeek(expectedWeek);
    } else if (week < expectedWeek) {
      break;
    }
  }

  return consecutive >= minWeeks;
}

async function checkActiveMonths(
  userId: string,
  minMonths: number,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<boolean> {
  const matches = await getValidatedMatchesForUser(userId, supabase, cache);
  if (matches.length === 0) return false;

  const months = new Set<string>();
  for (const match of matches) {
    const date = new Date(match.created_at);
    months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }

  return months.size >= minMonths;
}

async function checkFirstWeekActivity(
  userId: string,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<boolean> {
  const userCreatedAt = await getUserCreatedAt(userId, supabase, cache);
  if (!userCreatedAt) return false;

  const createdAt = new Date(userCreatedAt);
  const oneWeekLater = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const matches = await getValidatedMatchesForUser(userId, supabase, cache);
  return matches.some((match) => new Date(match.created_at) <= oneWeekLater);
}

async function checkFirstMonthMatches(
  userId: string,
  minMatches: number,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<boolean> {
  const userCreatedAt = await getUserCreatedAt(userId, supabase, cache);
  if (!userCreatedAt) return false;

  const createdAt = new Date(userCreatedAt);
  const oneMonthLater = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const matches = await getValidatedMatchesForUser(userId, supabase, cache);
  const matchesInFirstMonth = matches.filter(
    (match) => new Date(match.created_at) <= oneMonthLater
  ).length;
  return matchesInFirstMonth >= minMatches;
}

async function checkComeback(
  userId: string,
  inactiveDays: number,
  supabase: ServerSupabaseClient,
  cache: AchievementEvaluationCache
): Promise<boolean> {
  const matches = await getValidatedMatchesForUser(userId, supabase, cache);
  if (matches.length < 2) return false;

  const lastMatch = new Date(matches[0].created_at);
  const previousMatch = new Date(matches[1].created_at);
  const diffDays = Math.floor((lastMatch.getTime() - previousMatch.getTime()) / (1000 * 60 * 60 * 24));

  return diffDays >= inactiveDays;
}

// Helpers para semanas ISO
function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getCurrentISOWeek(): string {
  return getISOWeek(new Date());
}

function getPreviousISOWeek(week: string): string {
  const [year, weekPart] = week.split("-W");
  const weekNo = parseInt(weekPart, 10);
  if (weekNo === 1) {
    return `${parseInt(year, 10) - 1}-W52`;
  }
  return `${year}-W${String(weekNo - 1).padStart(2, "0")}`;
}
