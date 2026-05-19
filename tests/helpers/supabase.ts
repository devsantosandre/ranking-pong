import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { deleteSingleTestUser } from "./cleanup";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
export const TEST_USER_PREFIX = process.env.TEST_USER_PREFIX || "qa-rankingpong";
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "Qa!Rank1ng#2026";

// Cliente "admin" usando service_role — bypassa RLS e pode criar/deletar usuários.
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Cliente anônimo — usado para verificar o comportamento de RLS sem sessão.
export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Cliente que entra em sessão de um usuário específico (token JWT do auth).
export function userClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type TestUser = {
  id: string;
  email: string;
  password: string;
  name: string;
  accessToken: string;
};

function uniqueEmail(label: string) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${TEST_USER_PREFIX}-${label}-${ts}-${rand}@example.com`;
}

// Cria um usuário no Auth (confirmado), garante linha em public.users e devolve sessão.
export async function createTestUser(label: string): Promise<TestUser> {
  const admin = adminClient();
  const email = uniqueEmail(label);
  const password = TEST_USER_PASSWORD;
  const name = `QA ${label} ${Math.random().toString(36).slice(2, 6)}`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (createError || !created?.user) {
    throw new Error(`Falha ao criar usuário ${label}: ${createError?.message}`);
  }

  const userId = created.user.id;

  // O trigger handle_new_user deve ter criado a linha em public.users; ajusta o nome
  // explicitamente para o caso de bancos sem o trigger e para garantir idempotência.
  await admin
    .from("users")
    .upsert(
      {
        id: userId,
        email,
        name,
        full_name: name,
        role: "player",
        rating_atual: 250,
      },
      { onConflict: "id" }
    );

  // Faz signIn anon para obter access_token usável no userClient
  const anon = anonClient();
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signIn?.session) {
    throw new Error(`Falha ao logar usuário ${label}: ${signInError?.message}`);
  }

  return {
    id: userId,
    email,
    password,
    name,
    accessToken: signIn.session.access_token,
  };
}

// Remove o usuário com limpeza ordenada:
// 1. Tabelas sem ON DELETE CASCADE (ex.: admin_logs.admin_id)
// 2. Auth user — cascateia public.users → matches, notifications, daily_limits, etc.
export async function deleteTestUser(userId: string): Promise<void> {
  await deleteSingleTestUser(userId, adminClient());
}

// Garante que um usuário tenha role específico (ex.: admin)
export async function setUserRole(userId: string, role: "player" | "moderator" | "admin") {
  const admin = adminClient();
  const { error } = await admin
    .from("users")
    .update({ role })
    .eq("id", userId);
  if (error) {
    throw new Error(`Falha ao atualizar role do usuário ${userId}: ${error.message}`);
  }
}

// Mede latência simples (ms) de uma função assíncrona
export async function measureMs<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}
