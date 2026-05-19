import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, anonClient, createTestUser, deleteTestUser, TestUser } from "../helpers/supabase";

// ── helpers compartilhados ─────────────────────────────────────────────────

async function registerMatchRpc(params: {
  playerA: TestUser;
  playerB: TestUser;
  scoreA?: number;
  scoreB?: number;
}): Promise<string> {
  const supa = anonClient();
  await supa.auth.signInWithPassword({
    email: params.playerA.email,
    password: params.playerA.password,
  });
  const { data, error } = await supa.rpc("register_match_with_notification_v1", {
    p_player_id: params.playerA.id,
    p_opponent_id: params.playerB.id,
    p_resultado_a: params.scoreA ?? 3,
    p_resultado_b: params.scoreB ?? 1,
    p_request_id: randomUUID(),
    p_timezone: "America/Sao_Paulo",
  });
  if (error) throw new Error(`register_failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return row.match_id as string;
}

async function confirmMatchRpc(
  matchId: string,
  actorId: string,
  actorName: string,
  actorType: "player" | "admin" | "system" = "player"
): Promise<{ error: { message: string } | null }> {
  const admin = adminClient();
  const { error } = await admin.rpc("validate_pending_match_v2", {
    p_match_id: matchId,
    p_actor_user_id: actorId,
    p_actor_name: actorName,
    p_actor_type: actorType,
  });
  return { error: error as { message: string } | null };
}

async function cancelMatchRpc(
  matchId: string
): Promise<{ error: { message: string } | null }> {
  const admin = adminClient();
  const { error } = await admin.rpc("cancel_match_v2", { p_match_id: matchId });
  return { error: error as { message: string } | null };
}

async function contestMatchDirect(params: {
  matchId: string;
  contesterId: string;
  playerAId: string;
  playerBId: string;
  newScoreA: number;
  newScoreB: number;
}): Promise<void> {
  const admin = adminClient();
  const vencedorId =
    params.newScoreA > params.newScoreB ? params.playerAId : params.playerBId;
  const { error } = await admin
    .from("matches")
    .update({
      resultado_a: params.newScoreA,
      resultado_b: params.newScoreB,
      vencedor_id: vencedorId,
      status: "edited",
      criado_por: params.contesterId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.matchId);
  if (error) throw new Error(`contest_failed: ${error.message}`);
}

async function reportNonexistentDirect(params: {
  matchId: string;
  reporterId: string;
  recipientId: string;
  originalCreatedBy: string;
}): Promise<void> {
  const admin = adminClient();
  const { error: updateErr } = await admin
    .from("matches")
    .update({
      status: "edited",
      criado_por: params.reporterId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.matchId);
  if (updateErr) throw new Error(`nonexistent_update_failed: ${updateErr.message}`);

  const { error: notifErr } = await admin.from("notifications").insert({
    user_id: params.recipientId,
    tipo: "confirmacao",
    payload: {
      event: "nonexistent_claimed",
      match_id: params.matchId,
      status: "edited",
      actor_id: params.reporterId,
      actor_name: null,
      created_by: params.originalCreatedBy,
    },
    lida: false,
  });
  if (notifErr) throw new Error(`nonexistent_notif_failed: ${notifErr.message}`);
}

async function confirmDidHappenDirect(params: {
  matchId: string;
  confirmerId: string;
  recipientId: string;
}): Promise<void> {
  const admin = adminClient();
  const { error: updateErr } = await admin
    .from("matches")
    .update({
      status: "edited",
      criado_por: params.confirmerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.matchId);
  if (updateErr) throw new Error(`confirm_happened_update_failed: ${updateErr.message}`);

  const { error: notifErr } = await admin.from("notifications").insert({
    user_id: params.recipientId,
    tipo: "confirmacao",
    payload: {
      event: "nonexistent_rejected",
      match_id: params.matchId,
      status: "edited",
      actor_id: params.confirmerId,
      actor_name: null,
      created_by: params.confirmerId,
    },
    lida: false,
  });
  if (notifErr) throw new Error(`confirm_happened_notif_failed: ${notifErr.message}`);
}

async function getMatch(matchId: string) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("matches")
    .select("status, criado_por, vencedor_id, resultado_a, resultado_b, player_a_id, player_b_id")
    .eq("id", matchId)
    .single();
  if (error) throw new Error(`fetch_match_failed: ${error.message}`);
  return data;
}

async function getUserRating(userId: string): Promise<number> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("users")
    .select("rating_atual")
    .eq("id", userId)
    .single();
  if (error) throw new Error(`fetch_user_failed: ${error.message}`);
  return data?.rating_atual ?? 250;
}

async function getLatestNotif(
  userId: string,
  matchId: string,
  event: string
): Promise<unknown> {
  const admin = adminClient();
  const { data } = await admin
    .from("notifications")
    .select("payload")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data ?? []).find(
    (n) =>
      (n.payload as { event?: string; match_id?: string })?.event === event &&
      (n.payload as { match_id?: string })?.match_id === matchId
  );
}

// ── 1. Registro → Confirmação direta ─────────────────────────────────────

describe("1. Registro → Confirmação direta (happy path)", () => {
  let playerA: TestUser;
  let playerB: TestUser;
  let matchId: string;
  const created: TestUser[] = [];

  beforeAll(async () => {
    playerA = await createTestUser("flow1-a");
    playerB = await createTestUser("flow1-b");
    created.push(playerA, playerB);
    matchId = await registerMatchRpc({ playerA, playerB, scoreA: 3, scoreB: 1 });
  });

  afterAll(async () => {
    for (const u of created) await deleteTestUser(u.id);
  });

  it("partida criada com status pendente e criado_por = player A", async () => {
    const match = await getMatch(matchId);
    expect(match.status).toBe("pendente");
    expect(match.criado_por).toBe(playerA.id);
    expect(match.resultado_a).toBe(3);
    expect(match.resultado_b).toBe(1);
    expect(match.vencedor_id).toBe(playerA.id);
  });

  it("player A não pode confirmar sua própria partida → actor_not_waiting_user", async () => {
    // criado_por=A → o responsável pela confirmação é B, não A
    const { error } = await confirmMatchRpc(matchId, playerA.id, playerA.name, "player");
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toMatch(/actor_not_waiting_user/);
  });

  it("player B confirma → status validado, A vence (3×1)", async () => {
    const { error } = await confirmMatchRpc(matchId, playerB.id, playerB.name, "player");
    expect(error, error?.message).toBeNull();

    const match = await getMatch(matchId);
    expect(match.status).toBe("validado");
    expect(match.vencedor_id).toBe(playerA.id);
  });

  it("ELO atualizado: vencedor (A) ganha rating, perdedor (B) perde", async () => {
    const ratingA = await getUserRating(playerA.id);
    const ratingB = await getUserRating(playerB.id);
    expect(ratingA).toBeGreaterThan(250);
    expect(ratingB).toBeLessThan(250);
  });

  it("tentar confirmar de novo → already_validated", async () => {
    const { error } = await confirmMatchRpc(matchId, playerB.id, playerB.name, "player");
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toMatch(/already_validated/);
  });
});

// ── 2. Registro → Contestação → Re-confirmação ───────────────────────────

describe("2. Registro → Contestação pelo adversário → Re-confirmação", () => {
  let playerA: TestUser;
  let playerB: TestUser;
  let matchId: string;
  const created: TestUser[] = [];

  beforeAll(async () => {
    playerA = await createTestUser("flow2-a");
    playerB = await createTestUser("flow2-b");
    created.push(playerA, playerB);
    // A registra 3×1 (A vence)
    matchId = await registerMatchRpc({ playerA, playerB, scoreA: 3, scoreB: 1 });
  });

  afterAll(async () => {
    for (const u of created) await deleteTestUser(u.id);
  });

  it("partida criada 3×1: A vence, status pendente", async () => {
    const match = await getMatch(matchId);
    expect(match.status).toBe("pendente");
    expect(match.vencedor_id).toBe(playerA.id);
  });

  it("player B contesta com placar invertido 1×3 (B vence) → edited, criado_por=B", async () => {
    await contestMatchDirect({
      matchId,
      contesterId: playerB.id,
      playerAId: playerA.id,
      playerBId: playerB.id,
      newScoreA: 1,
      newScoreB: 3,
    });

    const match = await getMatch(matchId);
    expect(match.status).toBe("edited");
    expect(match.criado_por).toBe(playerB.id);
    expect(match.resultado_a).toBe(1);
    expect(match.resultado_b).toBe(3);
    expect(match.vencedor_id).toBe(playerB.id);
  });

  it("player B não pode confirmar seu próprio placar contestado → actor_not_waiting_user", async () => {
    // criado_por=B → o responsável é A, não B
    const { error } = await confirmMatchRpc(matchId, playerB.id, playerB.name, "player");
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toMatch(/actor_not_waiting_user/);
  });

  it("player A (agora responsável) confirma o novo placar → validado, B vence", async () => {
    const { error } = await confirmMatchRpc(matchId, playerA.id, playerA.name, "player");
    expect(error, error?.message).toBeNull();

    const match = await getMatch(matchId);
    expect(match.status).toBe("validado");
    expect(match.vencedor_id).toBe(playerB.id);
  });

  it("ELO atualizado: B ganhou rating, A perdeu (placar contestado prevaleceu)", async () => {
    const ratingA = await getUserRating(playerA.id);
    const ratingB = await getUserRating(playerB.id);
    expect(ratingB).toBeGreaterThan(250);
    expect(ratingA).toBeLessThan(250);
  });
});

// ── 3. Jogo inexistente → Confirmar que aconteceu → Confirmar placar ─────

describe("3. Registro → Jogo inexistente → Confirmar que aconteceu → Confirmar placar", () => {
  let playerA: TestUser;
  let playerB: TestUser;
  let matchId: string;
  const created: TestUser[] = [];

  beforeAll(async () => {
    playerA = await createTestUser("flow3-a");
    playerB = await createTestUser("flow3-b");
    created.push(playerA, playerB);
    // A registra 3×0 (A vence)
    matchId = await registerMatchRpc({ playerA, playerB, scoreA: 3, scoreB: 0 });
  });

  afterAll(async () => {
    for (const u of created) await deleteTestUser(u.id);
  });

  it("partida criada (status pendente, criado_por=A)", async () => {
    const match = await getMatch(matchId);
    expect(match.status).toBe("pendente");
    expect(match.criado_por).toBe(playerA.id);
  });

  it("player B reporta jogo como inexistente → edited, criado_por=B + notif nonexistent_claimed", async () => {
    await reportNonexistentDirect({
      matchId,
      reporterId: playerB.id,
      recipientId: playerA.id,
      originalCreatedBy: playerA.id,
    });

    const match = await getMatch(matchId);
    expect(match.status).toBe("edited");
    expect(match.criado_por).toBe(playerB.id);

    // notificação nonexistent_claimed foi inserida para A
    const notif = await getLatestNotif(playerA.id, matchId, "nonexistent_claimed");
    expect(notif).toBeTruthy();
  });

  it("player A (responsável) confirma que o jogo aconteceu → edited, criado_por=A + notif nonexistent_rejected", async () => {
    await confirmDidHappenDirect({
      matchId,
      confirmerId: playerA.id,
      recipientId: playerB.id,
    });

    const match = await getMatch(matchId);
    expect(match.status).toBe("edited");
    expect(match.criado_por).toBe(playerA.id);

    // notificação nonexistent_rejected foi inserida para B
    const notif = await getLatestNotif(playerB.id, matchId, "nonexistent_rejected");
    expect(notif).toBeTruthy();
  });

  it("player B (responsável após rejeição) confirma o placar → validado, A vence (3×0 original)", async () => {
    // criado_por=A → waiter=B → B confirma
    const { error } = await confirmMatchRpc(matchId, playerB.id, playerB.name, "player");
    expect(error, error?.message).toBeNull();

    const match = await getMatch(matchId);
    expect(match.status).toBe("validado");
    expect(match.vencedor_id).toBe(playerA.id);
    // placar original inalterado
    expect(match.resultado_a).toBe(3);
    expect(match.resultado_b).toBe(0);
  });

  it("ELO atualizado: A venceu, B perdeu", async () => {
    const ratingA = await getUserRating(playerA.id);
    const ratingB = await getUserRating(playerB.id);
    expect(ratingA).toBeGreaterThan(250);
    expect(ratingB).toBeLessThan(250);
  });
});

// ── 4. Jogo inexistente → Cancelar ───────────────────────────────────────

describe("4. Registro → Jogo inexistente → Cancelar (A aceita cancelamento)", () => {
  let playerA: TestUser;
  let playerB: TestUser;
  let matchId: string;
  const created: TestUser[] = [];

  beforeAll(async () => {
    playerA = await createTestUser("flow4-a");
    playerB = await createTestUser("flow4-b");
    created.push(playerA, playerB);
    matchId = await registerMatchRpc({ playerA, playerB, scoreA: 2, scoreB: 1 });
  });

  afterAll(async () => {
    for (const u of created) await deleteTestUser(u.id);
  });

  it("player B reporta inexistente → edited, criado_por=B", async () => {
    await reportNonexistentDirect({
      matchId,
      reporterId: playerB.id,
      recipientId: playerA.id,
      originalCreatedBy: playerA.id,
    });

    const match = await getMatch(matchId);
    expect(match.status).toBe("edited");
    expect(match.criado_por).toBe(playerB.id);
  });

  it("A aceita o cancelamento via cancel_match_v2 → cancelado", async () => {
    const { error } = await cancelMatchRpc(matchId);
    expect(error, error?.message).toBeNull();

    const match = await getMatch(matchId);
    expect(match.status).toBe("cancelado");
  });

  it("tentar cancelar novamente → already_canceled", async () => {
    const { error } = await cancelMatchRpc(matchId);
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toMatch(/already_canceled/);
  });

  it("tentar confirmar partida já cancelada → already_canceled", async () => {
    const { error } = await confirmMatchRpc(matchId, playerB.id, playerB.name, "player");
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toMatch(/already_canceled/);
  });
});

// ── 5. Cancelamento admin — partida pendente ──────────────────────────────

describe("5. Cancelamento admin de partida pendente via cancel_match_v2", () => {
  let playerA: TestUser;
  let playerB: TestUser;
  let matchId: string;
  const created: TestUser[] = [];

  beforeAll(async () => {
    playerA = await createTestUser("flow5-a");
    playerB = await createTestUser("flow5-b");
    created.push(playerA, playerB);
    matchId = await registerMatchRpc({ playerA, playerB, scoreA: 3, scoreB: 2 });
  });

  afterAll(async () => {
    for (const u of created) await deleteTestUser(u.id);
  });

  it("admin cancela partida pendente → status cancelado", async () => {
    const { error } = await cancelMatchRpc(matchId);
    expect(error, error?.message).toBeNull();

    const match = await getMatch(matchId);
    expect(match.status).toBe("cancelado");
  });
});

// ── 6. Fluxo completo: Registro → Contestação → Contestação de volta → Validação ─

describe("6. Registro → dupla contestação (ping-pong) → validação final", () => {
  let playerA: TestUser;
  let playerB: TestUser;
  let matchId: string;
  const created: TestUser[] = [];

  beforeAll(async () => {
    playerA = await createTestUser("flow6-a");
    playerB = await createTestUser("flow6-b");
    created.push(playerA, playerB);
    // A registra 3×1 (A vence)
    matchId = await registerMatchRpc({ playerA, playerB, scoreA: 3, scoreB: 1 });
  });

  afterAll(async () => {
    for (const u of created) await deleteTestUser(u.id);
  });

  it("1ª contestação: B contesta com 1×3 (B vence) → edited, criado_por=B", async () => {
    await contestMatchDirect({
      matchId,
      contesterId: playerB.id,
      playerAId: playerA.id,
      playerBId: playerB.id,
      newScoreA: 1,
      newScoreB: 3,
    });

    const match = await getMatch(matchId);
    expect(match.status).toBe("edited");
    expect(match.criado_por).toBe(playerB.id);
    expect(match.vencedor_id).toBe(playerB.id);
  });

  it("2ª contestação: A reconteста com 3×1 (A vence de volta) → edited, criado_por=A", async () => {
    // A é o waiter após a primeira contestação (criado_por=B → waiter=A)
    await contestMatchDirect({
      matchId,
      contesterId: playerA.id,
      playerAId: playerA.id,
      playerBId: playerB.id,
      newScoreA: 3,
      newScoreB: 1,
    });

    const match = await getMatch(matchId);
    expect(match.status).toBe("edited");
    expect(match.criado_por).toBe(playerA.id);
    expect(match.vencedor_id).toBe(playerA.id);
  });

  it("B (waiter após 2ª contestação) aceita placar final → validado, A vence", async () => {
    // criado_por=A → waiter=B → B confirma
    const { error } = await confirmMatchRpc(matchId, playerB.id, playerB.name, "player");
    expect(error, error?.message).toBeNull();

    const match = await getMatch(matchId);
    expect(match.status).toBe("validado");
    expect(match.vencedor_id).toBe(playerA.id);
    expect(match.resultado_a).toBe(3);
    expect(match.resultado_b).toBe(1);
  });
});
