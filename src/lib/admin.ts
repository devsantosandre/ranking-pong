import { createClient } from "@/utils/supabase/server";

export type UserRole = "player" | "moderator" | "admin";

/**
 * Retorna o role do usuario atual
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  return (data?.role as UserRole) || "player";
}

/**
 * Retorna os dados do usuario atual incluindo role
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("id, name, full_name, email, role")
    .eq("id", user.id)
    .single();

  return data;
}

/**
 * Verifica se o usuario atual e moderator ou admin
 * Lanca erro se nao for
 */
export async function requireModerator(): Promise<void> {
  const role = await getCurrentUserRole();

  if (!role || (role !== "moderator" && role !== "admin")) {
    throw new Error("Acesso negado: requer permissao de moderator ou admin");
  }
}

/**
 * Verifica se o usuario atual e admin
 * Lanca erro se nao for
 */
export async function requireAdminOnly(): Promise<void> {
  const role = await getCurrentUserRole();

  if (!role || role !== "admin") {
    throw new Error("Acesso negado: requer permissao de admin");
  }
}

/**
 * Verifica se o usuario atual pode acessar a area admin
 */
export async function canAccessAdmin(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === "moderator" || role === "admin";
}

/**
 * Verifica se o usuario atual e admin
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === "admin";
}
