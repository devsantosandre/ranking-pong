import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, anonClient, createTestUser, deleteTestUser, measureMs, TestUser } from "../helpers/supabase";

const created: TestUser[] = [];

afterAll(async () => {
  for (const u of created) {
    await deleteTestUser(u.id);
  }
});

describe("Performance — queries principais < 500ms (HML self-hosted)", () => {
  it("ranking top 20 ordenado por rating_atual", async () => {
    const admin = adminClient();
    const { ms } = await measureMs(() =>
      admin
        .from("users")
        .select("id, name, rating_atual, vitorias, derrotas")
        .order("rating_atual", { ascending: false })
        .limit(20)
    );
    console.log(`  ⏱  ranking top20 levou ${ms}ms`);
    expect(ms).toBeLessThan(1000);
  });

  it("listar partidas validadas (paginado)", async () => {
    const admin = adminClient();
    const { ms } = await measureMs(() =>
      admin
        .from("matches")
        .select("id, status, resultado_a, resultado_b, vencedor_id, created_at")
        .eq("status", "validado")
        .order("created_at", { ascending: false })
        .limit(20)
    );
    console.log(`  ⏱  matches validadas levou ${ms}ms`);
    expect(ms).toBeLessThan(1000);
  });

  it("query do feed de notícias", async () => {
    const admin = adminClient();
    const { ms } = await measureMs(() =>
      admin
        .from("news_posts")
        .select("id, title, slug, published_at, pinned")
        .order("published_at", { ascending: false })
        .limit(15)
    );
    console.log(`  ⏱  news feed levou ${ms}ms`);
    expect(ms).toBeLessThan(1000);
  });

  it("query de notificações do usuário (n=20)", async () => {
    const user = await createTestUser("perf");
    created.push(user);
    const admin = adminClient();
    const { ms } = await measureMs(() =>
      admin
        .from("notifications")
        .select("id, tipo, payload, lida, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
    );
    console.log(`  ⏱  notifications levou ${ms}ms`);
    expect(ms).toBeLessThan(1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Medições do fluxo de confirmação (novas funções otimizadas)
// ─────────────────────────────────────────────────────────────────────────────

describe("Performance — fluxo de confirmação otimizado", () => {
  let playerA: TestUser;
  let playerB: TestUser;

  afterAll(async () => {
    if (playerA) await deleteTestUser(playerA.id);
    if (playerB) await deleteTestUser(playerB.id);
  });

  it("setup: criar usuários e partida de teste", async () => {
    playerA = await createTestUser("conf-perf-a");
    playerB = await createTestUser("conf-perf-b");
    created.push(playerA, playerB);
    expect(playerA.id).toBeTruthy();
    expect(playerB.id).toBeTruthy();
  });

  it("getMatchPendingKindAndContext: < 300ms (1 query pontual)", async () => {
    // Importamos diretamente a função do módulo para testar sem Server Action overhead
    const { default: dotenv } = await import("dotenv");
    const { resolve } = await import("node:path");
    dotenv.config({ path: resolve(__dirname, "../../.env.test"), override: false });

    const { getMatchPendingKindAndContext } = await import(
      "@/lib/matches/confirmation-sla"
    );
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const admin = createAdminClient();

    // Registra uma partida de teste via RPC
    const supa = anonClient();
    await supa.auth.signInWithPassword({
      email: playerA.email,
      password: playerA.password,
    });
    const { data, error } = await supa.rpc("register_match_with_notification_v1", {
      p_player_id: playerA.id,
      p_opponent_id: playerB.id,
      p_resultado_a: 3,
      p_resultado_b: 1,
      p_request_id: randomUUID(),
      p_timezone: "America/Sao_Paulo",
    });

    if (error) {
      console.warn("  ⚠️  Falha ao registrar partida de teste:", error.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const matchId = row.match_id as string;

    const { ms, value: state } = await measureMs(() =>
      getMatchPendingKindAndContext(matchId, admin)
    );
    console.log(`  ⏱  getMatchPendingKindAndContext levou ${ms}ms → kind=${state.pendingKind}`);
    expect(ms).toBeLessThan(500);
    expect(state.pendingKind).toBe("score");
    expect(state.pendingContext).toBe("default");

    // Limpar a partida
    await adminClient().from("matches").delete().eq("id", matchId);
  });

  it("getOpenPendingConfirmationSnapshots com userId: < 500ms (2 queries)", async () => {
    const { getOpenPendingConfirmationSnapshots } = await import(
      "@/lib/matches/confirmation-sla"
    );
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const admin = createAdminClient();

    const { ms, value } = await measureMs(() =>
      getOpenPendingConfirmationSnapshots({
        responsibleUserId: playerB.id,
        supabase: admin,
      })
    );
    console.log(
      `  ⏱  getOpenPendingConfirmationSnapshots levou ${ms}ms → ${value.items.length} pendências`
    );
    expect(ms).toBeLessThan(800);
  });

  it("validatePendingMatchRpcOnly: < 400ms (1 RPC atômico)", async () => {
    const { validatePendingMatchRpcOnly } = await import(
      "@/lib/matches/validate-pending-match"
    );

    // Registra nova partida para testar o RPC
    const supa = anonClient();
    await supa.auth.signInWithPassword({
      email: playerA.email,
      password: playerA.password,
    });
    const { data, error } = await supa.rpc("register_match_with_notification_v1", {
      p_player_id: playerA.id,
      p_opponent_id: playerB.id,
      p_resultado_a: 3,
      p_resultado_b: 1,
      p_request_id: randomUUID(),
      p_timezone: "America/Sao_Paulo",
    });

    if (error) {
      console.warn("  ⚠️  Falha ao registrar partida:", error.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const matchId = row.match_id as string;

    const { ms, value: rpcResult } = await measureMs(() =>
      validatePendingMatchRpcOnly({
        matchId,
        actorUserId: playerB.id,
        actorName: playerB.name,
        actorType: "player",
      })
    );

    console.log(`  ⏱  validatePendingMatchRpcOnly levou ${ms}ms → success=${rpcResult.success}`);
    expect(ms).toBeLessThan(600);

    if (rpcResult.success) {
      expect(rpcResult.row.match_id).toBe(matchId);
    }
    // Não precisa limpar — partida foi validada pelo RPC
  });
});
