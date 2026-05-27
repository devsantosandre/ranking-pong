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

/**
 * Prefixos de e-mail que identificam usuários criados pelos testes.
 * Usado na consulta à public.users (filtro SQL LIKE).
 */
export const TEST_EMAIL_PREFIXES = ["qa-rankingpong-", "qa-e2e-", "qa-debug-", "qa-"];

/**
 * Domínio reservado para e-mails de teste.
 * Todo usuário criado pelos testes usa @example.com — esse domínio jamais
 * é usado por usuários reais, por isso é um identificador seguro e abrangente
 * para varredura via auth.users (Admin API listUsers).
 */
export const TEST_EMAIL_DOMAIN = "@example.com";

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
 *
 * Estratégia de busca em duas camadas:
 *  1. auth.users (via Admin API listUsers) — captura usuários cujo upsert em
 *     public.users falhou (ex.: crash antes do segundo passo do createE2EUser).
 *  2. public.users (via tabela) — garante cobertura de usuários ativos normalmente.
 * Os IDs das duas fontes são mesclados (deduplicados) antes da exclusão.
 */
export async function purgeAllTestData(): Promise<{ deleted: number; failed: number }> {
  const admin = buildAdminClient();

  // ── Fonte 1: auth.users via Admin API (paginado, max 1000/página) ─────────
  // Usa TEST_EMAIL_DOMAIN (@example.com) como identificador universal: qualquer
  // usuário de teste usa esse domínio, independente do prefixo de label.
  const authIds = new Set<string>();
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.warn(`[cleanup] Falha ao listar auth.users (página ${page}): ${error.message}`);
      break;
    }
    for (const u of data.users ?? []) {
      if (u.email?.endsWith(TEST_EMAIL_DOMAIN)) {
        authIds.add(u.id);
      }
    }
    // Para quando a página retornar menos que perPage (última página)
    if ((data.users ?? []).length < 1000) break;
    page++;
  }

  // ── Fonte 2: public.users via tabela (cobre usuários totalmente criados) ──
  const orFilter = TEST_EMAIL_PREFIXES.map((p) => `email.like.${p}%`).join(",");
  const { data: publicUsers, error: listError } = await admin
    .from("users")
    .select("id, email")
    .or(orFilter);

  if (listError) {
    console.warn(`[cleanup] Erro ao listar public.users de teste: ${listError.message}`);
  }
  for (const u of publicUsers ?? []) {
    authIds.add(u.id);
  }

  if (authIds.size === 0) {
    return { deleted: 0, failed: 0 };
  }

  const userIds = [...authIds];

  // Limpar todas as tabelas sem CASCADE de uma só vez
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
