"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  requireModerator,
  requireAdminOnly,
  getCurrentUser,
} from "@/lib/admin";
import { revalidatePath } from "next/cache";

// ============================================================
// TIPOS
// ============================================================

export type AdminMatch = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  resultado_a: number;
  resultado_b: number;
  status: string;
  criado_por: string;
  aprovado_por: string | null;
  pontos_variacao_a: number | null;
  pontos_variacao_b: number | null;
  created_at: string;
  player_a: { id: string; name: string; full_name: string };
  player_b: { id: string; name: string; full_name: string };
};

export type AdminUser = {
  id: string;
  name: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  hide_from_ranking: boolean;
  rating_atual: number;
  vitorias: number;
  derrotas: number;
  jogos_disputados: number;
};

export type AdminSetting = {
  id: string;
  key: string;
  value: string;
  description: string;
  updated_at: string;
};

export type AdminLog = {
  id: string;
  admin_id: string;
  admin_role: string;
  action: string;
  action_description: string;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  admin?: { name: string; full_name: string };
};

// ============================================================
// HELPERS
// ============================================================

const MAX_PAGE = 1000; // Limite máximo de páginas para evitar abuso

function validatePage(page: number): number {
  if (typeof page !== "number" || isNaN(page)) return 0;
  if (page < 0) return 0;
  if (page > MAX_PAGE) return MAX_PAGE;
  return Math.floor(page);
}

async function createAdminLog(params: {
  action: string;
  action_description: string;
  target_type: string;
  target_id?: string;
  target_name?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  reason?: string;
}) {
  try {
    const supabase = await createClient();
    const admin = await getCurrentUser();

    if (!admin) {
      console.error("createAdminLog: Usuario nao autenticado");
      return; // Não falhar a operação principal por causa do log
    }

    const { error } = await supabase.from("admin_logs").insert({
      admin_id: admin.id,
      admin_role: admin.role,
      action: params.action,
      action_description: params.action_description,
      target_type: params.target_type,
      target_id: params.target_id || null,
      target_name: params.target_name || null,
      old_value: params.old_value || null,
      new_value: params.new_value || null,
      reason: params.reason || null,
    });

    if (error) {
      console.error("Erro ao criar log de admin (não crítico):", error);
    }
  } catch (error) {
    console.error("Erro inesperado ao criar log de admin:", error);
  }
}

// ============================================================
// PARTIDAS (moderator + admin)
// ============================================================

const PAGE_SIZE = 20;

export async function adminGetAllMatches(
  filters?: { status?: string },
  page = 0
) {
  await requireModerator();
  const supabase = await createClient();

  const validPage = validatePage(page);
  const from = validPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("matches")
    .select(
      `
      *,
      player_a:users!player_a_id(id, name, full_name),
      player_b:users!player_b_id(id, name, full_name)
    `
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters?.status && filters.status !== "todas") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return {
    matches: data as AdminMatch[],
    hasMore: data && data.length === PAGE_SIZE,
  };
}

export async function adminCancelMatch(matchId: string, reason: string) {
  await requireModerator();

  if (!reason || reason.trim().length < 3) {
    throw new Error("Motivo obrigatorio (minimo 3 caracteres)");
  }

  const supabase = await createClient();

  // Buscar partida atual
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(
      `
      *,
      player_a:users!player_a_id(id, name, full_name, rating_atual, vitorias, derrotas, jogos_disputados),
      player_b:users!player_b_id(id, name, full_name, rating_atual, vitorias, derrotas, jogos_disputados)
    `
    )
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    throw new Error("Partida nao encontrada");
  }

  if (match.status === "cancelado") {
    throw new Error("Partida ja esta cancelada");
  }

  const oldStatus = match.status;
  const targetName = `${match.player_a.full_name || match.player_a.name} vs ${match.player_b.full_name || match.player_b.name} (${match.resultado_a}x${match.resultado_b})`;

  // Se a partida estava validada, reverter pontos
  if (match.status === "validado" && match.vencedor_id) {
    const winnerId = match.vencedor_id;
    const loserId =
      winnerId === match.player_a_id ? match.player_b_id : match.player_a_id;

    const winner =
      winnerId === match.player_a_id ? match.player_a : match.player_b;
    const loser =
      loserId === match.player_a_id ? match.player_a : match.player_b;

    const pontosVitoria = match.pontos_variacao_a
      ? winnerId === match.player_a_id
        ? match.pontos_variacao_a
        : match.pontos_variacao_b
      : 20;
    const pontosDerrota = match.pontos_variacao_b
      ? loserId === match.player_a_id
        ? match.pontos_variacao_a
        : match.pontos_variacao_b
      : 8;

    // Reverter pontos do vencedor
    const { error: winnerError } = await supabase
      .from("users")
      .update({
        rating_atual: winner.rating_atual - pontosVitoria,
        vitorias: Math.max(0, winner.vitorias - 1),
        jogos_disputados: Math.max(0, winner.jogos_disputados - 1),
      })
      .eq("id", winnerId);

    if (winnerError) {
      throw new Error("Erro ao reverter pontos do vencedor");
    }

    // Reverter pontos do perdedor
    const { error: loserError } = await supabase
      .from("users")
      .update({
        rating_atual: loser.rating_atual - pontosDerrota,
        derrotas: Math.max(0, loser.derrotas - 1),
        jogos_disputados: Math.max(0, loser.jogos_disputados - 1),
      })
      .eq("id", loserId);

    if (loserError) {
      throw new Error("Erro ao reverter pontos do perdedor");
    }

    // Registrar transacoes de reversao
    const { error: transactionError } = await supabase.from("rating_transactions").insert([
      {
        match_id: matchId,
        user_id: winnerId,
        motivo: "reversao_admin",
        valor: -pontosVitoria,
        rating_antes: winner.rating_atual,
        rating_depois: winner.rating_atual - pontosVitoria,
      },
      {
        match_id: matchId,
        user_id: loserId,
        motivo: "reversao_admin",
        valor: -pontosDerrota,
        rating_antes: loser.rating_atual,
        rating_depois: loser.rating_atual - pontosDerrota,
      },
    ]);

    if (transactionError) {
      console.error("Erro ao registrar transações de reversão (não crítico):", transactionError);
    }
  }

  // Atualizar status da partida
  const { error: cancelError } = await supabase
    .from("matches")
    .update({ status: "cancelado" })
    .eq("id", matchId);

  if (cancelError) {
    throw new Error("Erro ao cancelar partida");
  }

  // Registrar log
  await createAdminLog({
    action: "match_cancelled",
    action_description:
      oldStatus === "validado"
        ? "Partida cancelada e pontos revertidos"
        : "Partida cancelada",
    target_type: "match",
    target_id: matchId,
    target_name: targetName,
    old_value: { status: oldStatus },
    new_value: { status: "cancelado" },
    reason: reason.trim(),
  });

  revalidatePath("/admin");
  revalidatePath("/partidas");
  revalidatePath("/ranking");

  return { success: true };
}

// ============================================================
// JOGADORES - Moderator + Admin
// ============================================================

export async function adminGetAllUsers(
  filters?: { status?: string; role?: string },
  page = 0
) {
  await requireModerator();
  const supabase = await createClient();

  const validPage = validatePage(page);
  const from = validPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("users")
    .select(
      "id, name, full_name, email, role, is_active, hide_from_ranking, rating_atual, vitorias, derrotas, jogos_disputados"
    )
    .order("rating_atual", { ascending: false });

  // Filtro de status
  if (filters?.status === "ativos") {
    query = query.eq("is_active", true);
  } else if (filters?.status === "inativos") {
    query = query.eq("is_active", false);
  }

  // Filtro de role
  if (filters?.role && filters.role !== "todos") {
    query = query.eq("role", filters.role);
  }

  const { data, error } = await query.range(from, to);

  if (error) throw new Error(error.message);
  return {
    users: data as AdminUser[],
    hasMore: data && data.length === PAGE_SIZE,
  };
}

// Busca de usuários por texto (sem paginação - para busca completa)
export async function adminSearchUsers(
  search: string,
  filters?: { status?: string; role?: string }
): Promise<AdminUser[]> {
  await requireModerator();
  const supabase = await createClient();

  if (!search || search.trim().length < 2) {
    return [];
  }

  const searchTerm = `%${search.trim()}%`;

  let query = supabase
    .from("users")
    .select(
      "id, name, full_name, email, role, is_active, hide_from_ranking, rating_atual, vitorias, derrotas, jogos_disputados"
    )
    .or(`name.ilike.${searchTerm},full_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
    .order("rating_atual", { ascending: false })
    .limit(50); // Limita a 50 resultados na busca

  // Filtro de status
  if (filters?.status === "ativos") {
    query = query.eq("is_active", true);
  } else if (filters?.status === "inativos") {
    query = query.eq("is_active", false);
  }

  // Filtro de role
  if (filters?.role && filters.role !== "todos") {
    query = query.eq("role", filters.role);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data as AdminUser[];
}

export async function adminCreateUser(
  name: string,
  email: string,
  tempPassword: string
) {
  await requireModerator();

  if (!name || name.trim().length < 2) {
    throw new Error("Nome obrigatorio (minimo 2 caracteres)");
  }

  if (!email || !email.includes("@")) {
    throw new Error("Email invalido");
  }

  if (!tempPassword || tempPassword.length < 6) {
    throw new Error("Senha temporaria deve ter no minimo 6 caracteres");
  }

  const supabase = await createClient();
  const adminClient = createAdminClient();
  const normalizedEmail = email.toLowerCase().trim();

  // Verificar se email ja existe na tabela users
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .single();

  if (existingUser) {
    throw new Error("Email ja cadastrado");
  }

  // Buscar rating inicial das configuracoes
  const { data: ratingConfig } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "rating_inicial")
    .single();

  const ratingInicial = parseInt(ratingConfig?.value || "250", 10);

  // Tentar criar usuario no Supabase Auth (requer service_role_key)
  let userId: string;

  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        full_name: name.trim(),
      },
    });

  if (authError) {
    // Se o erro for de email já existente, tentar obter o usuário existente
    if (authError.message.includes("already been registered") ||
        authError.message.includes("already exists")) {
      // Buscar usuário existente no Auth por email
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existingAuthUser = listData?.users?.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      if (existingAuthUser) {
        userId = existingAuthUser.id;
        // Atualizar a senha do usuário existente
        await adminClient.auth.admin.updateUserById(userId, {
          password: tempPassword,
        });
      } else {
        throw new Error(`Erro ao criar usuario: ${authError.message}`);
      }
    } else {
      throw new Error(`Erro ao criar usuario: ${authError.message}`);
    }
  } else {
    userId = authData.user.id;
  }

  // Criar ou atualizar registro na tabela users (upsert)
  const { error: userError } = await supabase.from("users").upsert({
    id: userId,
    name: name.trim(),
    full_name: name.trim(),
    email: normalizedEmail,
    role: "player",
    is_active: true,
    rating_atual: ratingInicial,
    vitorias: 0,
    derrotas: 0,
    jogos_disputados: 0,
  }, { onConflict: "id" });

  if (userError) {
    // Tentar deletar o usuario do auth se falhar (requer service_role_key)
    await adminClient.auth.admin.deleteUser(userId);
    throw new Error(`Erro ao criar perfil: ${userError.message}`);
  }

  // Registrar log
  await createAdminLog({
    action: "user_created",
    action_description: "Novo jogador criado",
    target_type: "user",
    target_id: userId,
    target_name: name.trim(),
    new_value: { name: name.trim(), email: email.toLowerCase().trim() },
  });

  revalidatePath("/admin");
  revalidatePath("/ranking");

  return { success: true, userId };
}

export async function adminResetPassword(
  userId: string,
  newTempPassword: string
) {
  await requireModerator();

  if (!newTempPassword || newTempPassword.length < 6) {
    throw new Error("Senha temporaria deve ter no minimo 6 caracteres");
  }

  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Buscar usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, email")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  // Resetar senha (requer service_role_key)
  const { error: authError } = await adminClient.auth.admin.updateUserById(
    userId,
    {
      password: newTempPassword,
    }
  );

  if (authError) {
    throw new Error(`Erro ao resetar senha: ${authError.message}`);
  }

  // Registrar log
  await createAdminLog({
    action: "user_password_reset",
    action_description: "Senha resetada",
    target_type: "user",
    target_id: userId,
    target_name: user.full_name || user.name,
  });

  revalidatePath("/admin");

  return { success: true };
}

// ============================================================
// JOGADORES - Apenas Admin
// ============================================================

export async function adminUpdateUserRating(
  userId: string,
  newRating: number,
  reason: string
) {
  await requireAdminOnly();

  if (!reason || reason.trim().length < 3) {
    throw new Error("Motivo obrigatorio (minimo 3 caracteres)");
  }

  if (newRating < 0 || newRating > 9999) {
    throw new Error("Rating deve estar entre 0 e 9999");
  }

  const supabase = await createClient();

  // Buscar usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, rating_atual")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  const oldRating = user.rating_atual;

  // Atualizar rating
  const { error: updateError } = await supabase
    .from("users")
    .update({ rating_atual: newRating })
    .eq("id", userId);

  if (updateError) {
    throw new Error("Erro ao atualizar rating do usuário");
  }

  // Registrar transacao
  const { error: transactionError } = await supabase.from("rating_transactions").insert({
    user_id: userId,
    motivo: `ajuste_admin: ${reason.trim()}`,
    valor: newRating - oldRating,
    rating_antes: oldRating,
    rating_depois: newRating,
  });

  if (transactionError) {
    console.error("Erro ao registrar transação (não crítico):", transactionError);
  }

  // Registrar log
  await createAdminLog({
    action: "user_rating_changed",
    action_description: "Pontos alterados manualmente",
    target_type: "user",
    target_id: userId,
    target_name: user.full_name || user.name,
    old_value: { rating_atual: oldRating },
    new_value: { rating_atual: newRating },
    reason: reason.trim(),
  });

  revalidatePath("/admin");
  revalidatePath("/ranking");

  return { success: true };
}

export async function adminToggleUserStatus(userId: string) {
  await requireAdminOnly();
  const supabase = await createClient();

  // Buscar usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, is_active")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  const newStatus = !user.is_active;

  // Atualizar status
  const { error: updateError } = await supabase
    .from("users")
    .update({ is_active: newStatus })
    .eq("id", userId);

  if (updateError) {
    throw new Error("Erro ao atualizar status do usuário");
  }

  // Registrar log
  await createAdminLog({
    action: newStatus ? "user_activated" : "user_deactivated",
    action_description: newStatus ? "Jogador ativado" : "Jogador desativado",
    target_type: "user",
    target_id: userId,
    target_name: user.full_name || user.name,
    old_value: { is_active: user.is_active },
    new_value: { is_active: newStatus },
  });

  revalidatePath("/admin");
  revalidatePath("/ranking");

  return { success: true, newStatus };
}

export async function adminToggleHideFromRanking(userId: string) {
  await requireAdminOnly();
  const supabase = await createClient();

  // Buscar usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, hide_from_ranking")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  const newStatus = !user.hide_from_ranking;

  // Se está tentando ocultar (newStatus = true), verificar se há partidas pendentes
  if (newStatus === true) {
    const { data: pendingMatches, error: matchesError } = await supabase
      .from("matches")
      .select("id")
      .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
      .in("status", ["pendente", "edited"])
      .limit(1);

    if (matchesError) {
      throw new Error("Erro ao verificar partidas pendentes");
    }

    if (pendingMatches && pendingMatches.length > 0) {
      throw new Error(
        "Nao e possivel ocultar do ranking enquanto houver partidas pendentes. Confirme ou cancele as partidas pendentes primeiro."
      );
    }
  }

  // Atualizar status
  const { error: updateError } = await supabase
    .from("users")
    .update({ hide_from_ranking: newStatus })
    .eq("id", userId);

  if (updateError) {
    throw new Error("Erro ao atualizar visibilidade no ranking");
  }

  // Registrar log
  await createAdminLog({
    action: newStatus ? "user_hidden_from_ranking" : "user_shown_in_ranking",
    action_description: newStatus ? "Jogador oculto do ranking" : "Jogador visível no ranking",
    target_type: "user",
    target_id: userId,
    target_name: user.full_name || user.name,
    old_value: { hide_from_ranking: user.hide_from_ranking },
    new_value: { hide_from_ranking: newStatus },
  });

  revalidatePath("/admin");
  revalidatePath("/ranking");

  return { success: true, newStatus };
}

export async function adminResetUserStats(userId: string) {
  await requireAdminOnly();
  const supabase = await createClient();

  // Buscar usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, rating_atual, vitorias, derrotas, jogos_disputados")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  // Buscar rating inicial
  const { data: ratingConfig } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "rating_inicial")
    .single();

  const ratingInicial = parseInt(ratingConfig?.value || "250", 10);

  // Resetar estatisticas
  const { error: resetError } = await supabase
    .from("users")
    .update({
      rating_atual: ratingInicial,
      vitorias: 0,
      derrotas: 0,
      jogos_disputados: 0,
      streak: 0,
    })
    .eq("id", userId);

  if (resetError) {
    throw new Error("Erro ao resetar estatísticas do usuário");
  }

  // Registrar log
  await createAdminLog({
    action: "user_stats_reset",
    action_description: "Estatisticas resetadas",
    target_type: "user",
    target_id: userId,
    target_name: user.full_name || user.name,
    old_value: {
      rating_atual: user.rating_atual,
      vitorias: user.vitorias,
      derrotas: user.derrotas,
      jogos_disputados: user.jogos_disputados,
    },
    new_value: {
      rating_atual: ratingInicial,
      vitorias: 0,
      derrotas: 0,
      jogos_disputados: 0,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/ranking");

  return { success: true };
}

export async function adminChangeUserRole(
  userId: string,
  newRole: "player" | "moderator" | "admin"
) {
  await requireAdminOnly();
  const supabase = await createClient();
  const currentAdmin = await getCurrentUser();

  // Impedir admin de alterar proprio role
  if (currentAdmin?.id === userId) {
    throw new Error("Voce nao pode alterar seu proprio role");
  }

  // Buscar usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, role")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  const oldRole = user.role;

  // Atualizar role
  const { error: updateError } = await supabase
    .from("users")
    .update({ role: newRole })
    .eq("id", userId);

  if (updateError) {
    throw new Error("Erro ao atualizar role do usuário");
  }

  // Registrar log
  await createAdminLog({
    action: "user_role_changed",
    action_description: `Role alterado de ${oldRole} para ${newRole}`,
    target_type: "user",
    target_id: userId,
    target_name: user.full_name || user.name,
    old_value: { role: oldRole },
    new_value: { role: newRole },
  });

  revalidatePath("/admin");

  return { success: true };
}

// ============================================================
// CONFIGURACOES - Apenas Admin
// ============================================================

export async function adminGetSettings() {
  await requireModerator();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .order("key");

  if (error) throw new Error(error.message);
  return data as AdminSetting[];
}

export async function adminUpdateSetting(key: string, value: string) {
  await requireAdminOnly();
  const supabase = await createClient();
  const admin = await getCurrentUser();

  // Buscar configuracao atual
  const { data: oldSetting, error: settingError } = await supabase
    .from("settings")
    .select("*")
    .eq("key", key)
    .single();

  if (settingError || !oldSetting) {
    throw new Error("Configuracao nao encontrada");
  }

  // Atualizar configuracao
  const { error: updateError } = await supabase
    .from("settings")
    .update({
      value,
      updated_at: new Date().toISOString(),
      updated_by: admin?.id,
    })
    .eq("key", key);

  if (updateError) {
    throw new Error("Erro ao atualizar configuração");
  }

  // Registrar log
  await createAdminLog({
    action: "setting_changed",
    action_description: `Configuracao "${oldSetting.description || key}" alterada`,
    target_type: "setting",
    target_name: oldSetting.description || key,
    old_value: { value: oldSetting.value },
    new_value: { value },
  });

  revalidatePath("/admin");

  return { success: true };
}

// ============================================================
// LOGS
// ============================================================

export async function adminGetLogs(page = 0) {
  await requireModerator();
  const supabase = await createClient();

  const validPage = validatePage(page);
  const from = validPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from("admin_logs")
    .select(
      `
      *,
      admin:users!admin_id(name, full_name)
    `
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  return {
    logs: data as AdminLog[],
    hasMore: data && data.length === PAGE_SIZE,
  };
}
