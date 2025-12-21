"use server";

import { createClient } from "@/utils/supabase/server";
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
  const supabase = await createClient();
  const admin = await getCurrentUser();

  if (!admin) throw new Error("Usuario nao autenticado");

  await supabase.from("admin_logs").insert({
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

  const from = page * PAGE_SIZE;
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
    await supabase
      .from("users")
      .update({
        rating_atual: winner.rating_atual - pontosVitoria,
        vitorias: Math.max(0, winner.vitorias - 1),
        jogos_disputados: Math.max(0, winner.jogos_disputados - 1),
      })
      .eq("id", winnerId);

    // Reverter pontos do perdedor
    await supabase
      .from("users")
      .update({
        rating_atual: loser.rating_atual - pontosDerrota,
        derrotas: Math.max(0, loser.derrotas - 1),
        jogos_disputados: Math.max(0, loser.jogos_disputados - 1),
      })
      .eq("id", loserId);

    // Registrar transacoes de reversao
    await supabase.from("rating_transactions").insert([
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
  }

  // Atualizar status da partida
  await supabase
    .from("matches")
    .update({ status: "cancelado" })
    .eq("id", matchId);

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

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("users")
    .select(
      "id, name, full_name, email, role, is_active, rating_atual, vitorias, derrotas, jogos_disputados"
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

  // Verificar se email ja existe
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase().trim())
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

  // Criar usuario no Supabase Auth
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        full_name: name.trim(),
      },
    });

  if (authError) {
    throw new Error(`Erro ao criar usuario: ${authError.message}`);
  }

  // Criar registro na tabela users
  const { error: userError } = await supabase.from("users").insert({
    id: authData.user.id,
    name: name.trim(),
    full_name: name.trim(),
    email: email.toLowerCase().trim(),
    role: "player",
    is_active: true,
    rating_atual: ratingInicial,
    vitorias: 0,
    derrotas: 0,
    jogos_disputados: 0,
  });

  if (userError) {
    // Tentar deletar o usuario do auth se falhar
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(`Erro ao criar perfil: ${userError.message}`);
  }

  // Registrar log
  await createAdminLog({
    action: "user_created",
    action_description: "Novo jogador criado",
    target_type: "user",
    target_id: authData.user.id,
    target_name: name.trim(),
    new_value: { name: name.trim(), email: email.toLowerCase().trim() },
  });

  revalidatePath("/admin");
  revalidatePath("/ranking");

  return { success: true, userId: authData.user.id };
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

  // Buscar usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, email")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  // Resetar senha
  const { error: authError } = await supabase.auth.admin.updateUserById(
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
  await supabase
    .from("users")
    .update({ rating_atual: newRating })
    .eq("id", userId);

  // Registrar transacao
  await supabase.from("rating_transactions").insert({
    user_id: userId,
    motivo: `ajuste_admin: ${reason.trim()}`,
    valor: newRating - oldRating,
    rating_antes: oldRating,
    rating_depois: newRating,
  });

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
  await supabase
    .from("users")
    .update({ is_active: newStatus })
    .eq("id", userId);

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
  await supabase
    .from("users")
    .update({
      rating_atual: ratingInicial,
      vitorias: 0,
      derrotas: 0,
      jogos_disputados: 0,
      streak: 0,
    })
    .eq("id", userId);

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
  await supabase.from("users").update({ role: newRole }).eq("id", userId);

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
  await supabase
    .from("settings")
    .update({
      value,
      updated_at: new Date().toISOString(),
      updated_by: admin?.id,
    })
    .eq("key", key);

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

  const from = page * PAGE_SIZE;
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
