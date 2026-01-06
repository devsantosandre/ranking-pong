// Sistema de Conquistas/Medalhas
// Verifica e desbloqueia conquistas baseado em stats e eventos

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

// Verifica conquistas e retorna as que foram desbloqueadas
// IMPORTANTE: Esta função NUNCA deve lançar exceções para não quebrar a confirmação de partida
export async function checkAndUnlockAchievements(
  context: AchievementContext
): Promise<Achievement[]> {
  try {
    const supabase = await createClient();
    const unlockedAchievements: Achievement[] = [];

    // 1. Buscar todas as conquistas ativas
    const { data: allAchievements, error: achievementsError } = await supabase
      .from("achievements")
      .select("*")
      .eq("is_active", true);

    if (achievementsError || !allAchievements) {
      console.error("Erro ao buscar conquistas:", achievementsError);
      return [];
    }

    // 2. Buscar conquistas já desbloqueadas pelo usuário
    const { data: userAchievements, error: userAchievementsError } = await supabase
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", context.userId);

    if (userAchievementsError) {
      console.error("Erro ao buscar conquistas do usuário:", userAchievementsError);
      return [];
    }

    const unlockedIds = new Set(userAchievements?.map((ua) => ua.achievement_id) || []);

    // 3. Verificar cada conquista não desbloqueada
    for (const achievement of allAchievements) {
      if (unlockedIds.has(achievement.id)) continue;

      const shouldUnlock = await checkAchievementCondition(
        achievement,
        context,
        supabase
      );

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

        if (insertError) {
          // Log do erro mas não interrompe o processo
          console.error(
            `Erro ao desbloquear conquista ${achievement.key} para usuário ${context.userId}:`,
            insertError.message
          );
        } else {
          unlockedAchievements.push(achievement as Achievement);
        }
      }
    }

    return unlockedAchievements;
  } catch (error) {
    // Log do erro mas retorna array vazio para não quebrar a confirmação de partida
    console.error("Erro crítico ao verificar conquistas:", error);
    return [];
  }
}

// Verifica se uma condição específica de conquista foi atingida
async function checkAchievementCondition(
  achievement: Achievement,
  context: AchievementContext,
  supabase: Awaited<ReturnType<typeof createClient>>
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
      return await checkRankingPosition(context.userId, condition_value, supabase);

    // Conquistas especiais de partida
    case "underdog":
      if (!context.isWinner || !context.opponentRating) return false;
      return (context.opponentRating - context.rating) >= condition_value;

    case "perfect":
      return context.isWinner === true && context.resultado === "3x0";

    case "winrate":
      if (context.jogos < 20) return false;
      const winRate = (context.vitorias / context.jogos) * 100;
      return winRate >= condition_value;

    case "jogos_dia":
      return await checkMatchesInDay(context.userId, condition_value, supabase);

    // Conquistas sociais
    case "h2h":
      return await checkHeadToHead(context.userId, condition_value, supabase);

    case "oponentes_unicos":
      return await checkUniqueOpponents(context.userId, condition_value, supabase);

    // Conquistas de veterania
    case "dias_escola":
      return await checkDaysInSchool(context.userId, condition_value, supabase);

    // Conquistas de atividade
    case "semanas_consecutivas":
      return await checkConsecutiveWeeks(context.userId, condition_value, supabase);

    case "meses_ativos":
      return await checkActiveMonths(context.userId, condition_value, supabase);

    // Marcos temporais
    case "primeira_semana":
      return await checkFirstWeekActivity(context.userId, supabase);

    case "jogos_primeiro_mes":
      return await checkFirstMonthMatches(context.userId, condition_value, supabase);

    case "retorno":
      return await checkComeback(context.userId, condition_value, supabase);

    default:
      return false;
  }
}

// Helpers para verificações complexas

async function checkRankingPosition(
  userId: string,
  maxPosition: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data: users, error } = await supabase
    .from("users")
    .select("id")
    .eq("is_active", true)
    .eq("hide_from_ranking", false)
    .order("rating_atual", { ascending: false })
    .limit(maxPosition);

  if (error || !users) return false;
  return users.some((u) => u.id === userId);
}

async function checkMatchesInDay(
  userId: string,
  minMatches: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];

  const { count, error } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
    .eq("status", "validado")
    .gte("created_at", `${today}T00:00:00`)
    .lte("created_at", `${today}T23:59:59`);

  if (error) return false;
  return (count || 0) >= minMatches;
}

async function checkHeadToHead(
  userId: string,
  minMatches: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  // Buscar contagem de jogos por adversário
  const { data, error } = await supabase
    .from("matches")
    .select("player_a_id, player_b_id")
    .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
    .eq("status", "validado");

  if (error || !data) return false;

  const opponentCounts: Record<string, number> = {};
  for (const match of data) {
    const opponentId = match.player_a_id === userId ? match.player_b_id : match.player_a_id;
    opponentCounts[opponentId] = (opponentCounts[opponentId] || 0) + 1;
  }

  return Object.values(opponentCounts).some((count) => count >= minMatches);
}

async function checkUniqueOpponents(
  userId: string,
  minOpponents: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data, error } = await supabase
    .from("matches")
    .select("player_a_id, player_b_id")
    .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
    .eq("status", "validado");

  if (error || !data) return false;

  const opponents = new Set<string>();
  for (const match of data) {
    const opponentId = match.player_a_id === userId ? match.player_b_id : match.player_a_id;
    opponents.add(opponentId);
  }

  return opponents.size >= minOpponents;
}

async function checkDaysInSchool(
  userId: string,
  minDays: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data: user, error } = await supabase
    .from("users")
    .select("created_at")
    .eq("id", userId)
    .single();

  if (error || !user?.created_at) return false;

  const createdAt = new Date(user.created_at);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  return diffDays >= minDays;
}

async function checkConsecutiveWeeks(
  userId: string,
  minWeeks: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data, error } = await supabase
    .from("matches")
    .select("created_at")
    .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
    .eq("status", "validado")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return false;

  // Agrupar por semana ISO
  const weeks = new Set<string>();
  for (const match of data) {
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
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data, error } = await supabase
    .from("matches")
    .select("created_at")
    .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
    .eq("status", "validado");

  if (error || !data) return false;

  const months = new Set<string>();
  for (const match of data) {
    const date = new Date(match.created_at);
    months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }

  return months.size >= minMonths;
}

async function checkFirstWeekActivity(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("created_at")
    .eq("id", userId)
    .single();

  if (userError || !user?.created_at) return false;

  const createdAt = new Date(user.created_at);
  const oneWeekLater = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { count, error } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
    .eq("status", "validado")
    .lte("created_at", oneWeekLater.toISOString());

  if (error) return false;
  return (count || 0) >= 1;
}

async function checkFirstMonthMatches(
  userId: string,
  minMatches: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("created_at")
    .eq("id", userId)
    .single();

  if (userError || !user?.created_at) return false;

  const createdAt = new Date(user.created_at);
  const oneMonthLater = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { count, error } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
    .eq("status", "validado")
    .lte("created_at", oneMonthLater.toISOString());

  if (error) return false;
  return (count || 0) >= minMatches;
}

async function checkComeback(
  userId: string,
  inactiveDays: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data, error } = await supabase
    .from("matches")
    .select("created_at")
    .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
    .eq("status", "validado")
    .order("created_at", { ascending: false })
    .limit(2);

  if (error || !data || data.length < 2) return false;

  const lastMatch = new Date(data[0].created_at);
  const previousMatch = new Date(data[1].created_at);
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
