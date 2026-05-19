/**
 * Utilitário compartilhado de limpeza de dados de teste.
 *
 * Responsabilidades:
 *  - Identificar usuários de teste pelo prefixo de e-mail.
 *  - Excluir dependências sem CASCADE antes de excluir o usuário.
 *  - Ser idempotente: rodar múltiplas vezes não causa erro.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

/** Prefixos de e-mail que identificam usuários criados pelos testes. */
export const TEST_EMAIL_PREFIXES = ["qa-rankingpong-", "qa-e2e-"];

/**
 * Tabelas que precisam ser limpas explicitamente antes da exclusão do usuário
 * porque a FK de referência não tem ON DELETE CASCADE.
 *
 * Todas as demais tabelas (matches, notifications, daily_limits, rating_transactions,
 * ranking_snapshots, user_achievements, push_subscriptions, match_confirmation_state)
 * são cobertas pela cascata de auth.users → public.users.
 */
const NON_CASCADE_TABLES: Array<{ table: string; column: string }> = [
  { table: "admin_logs", column: "admin_id" },
];

function buildAdminClient(): SupabaseClient {
  // Carrega .env.test caso não esteja no ambiente (global-setup roda fora do vitest env)
  loadEnv({ path: resolve(__dirname, "../../.env.test"), override: false });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "[cleanup] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes. " +
        "Verifique .env.test antes de executar os testes."
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Exclui um único usuário de teste com limpeza ordenada:
 * 1. Remove registros em tabelas sem CASCADE (ex.: admin_logs.admin_id).
 * 2. Exclui o usuário do auth (cascateia public.users → todas as dependências).
 */
export async function deleteSingleTestUser(
  userId: string,
  adminClient?: SupabaseClient
): Promise<void> {
  const admin = adminClient ?? buildAdminClient();

  // Passo 1 — limpar dependências sem ON DELETE CASCADE
  for (const { table, column } of NON_CASCADE_TABLES) {
    const { error } = await admin.from(table).delete().eq(column, userId);
    if (error) {
      console.warn(`[cleanup] Falha ao limpar ${table}.${column} para ${userId}: ${error.message}`);
    }
  }

  // Passo 2 — excluir usuário do auth (cascateia tudo mais)
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    // Usuário já excluído em execução anterior — não é um erro real
    if (!error.message.toLowerCase().includes("not found") &&
        !error.message.toLowerCase().includes("user not found")) {
      console.warn(`[cleanup] Falha ao excluir usuário ${userId}: ${error.message}`);
    }
  }
}

/**
 * Localiza e exclui TODOS os usuários de teste identificados pelo prefixo de e-mail.
 * Use no globalSetup/globalTeardown para eliminar resquícios de execuções anteriores.
 */
export async function purgeAllTestData(): Promise<{ deleted: number; failed: number }> {
  const admin = buildAdminClient();

  // Montar filtro OR para todos os prefixos
  const orFilter = TEST_EMAIL_PREFIXES.map((p) => `email.like.${p}%`).join(",");

  const { data: testUsers, error: listError } = await admin
    .from("users")
    .select("id, email")
    .or(orFilter);

  if (listError) {
    console.warn(`[cleanup] Erro ao listar usuários de teste: ${listError.message}`);
    return { deleted: 0, failed: 0 };
  }

  if (!testUsers?.length) {
    return { deleted: 0, failed: 0 };
  }

  const userIds = testUsers.map((u) => u.id);

  // Limpar todas as tabelas sem CASCADE de uma só vez (IN é mais eficiente que N deletes)
  for (const { table, column } of NON_CASCADE_TABLES) {
    const { error } = await admin.from(table).delete().in(column, userIds);
    if (error) {
      console.warn(`[cleanup] Falha ao limpar ${table}.${column} em lote: ${error.message}`);
    }
  }

  let deleted = 0;
  let failed = 0;

  for (const userId of userIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      const isAlreadyGone =
        error.message.toLowerCase().includes("not found") ||
        error.message.toLowerCase().includes("user not found");
      if (!isAlreadyGone) {
        console.warn(`[cleanup] Falha ao excluir ${userId}: ${error.message}`);
        failed++;
      }
      // usuário já excluído conta como "limpo"
    } else {
      deleted++;
    }
  }

  return { deleted, failed };
}
