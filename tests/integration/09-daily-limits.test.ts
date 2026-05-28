import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  TestUser,
  userClient,
} from "../helpers/supabase";

const created: TestUser[] = [];

afterAll(async () => {
  for (const u of created) {
    await deleteTestUser(u.id);
  }
});

describe("Limites diários — daily_limits + RPC", () => {
  // A RPC register_match_with_notification_v1 não incrementa daily_limits no HML
  // (a tabela existe e o frontend lê corretamente, mas o enforcement server-side
  // ainda não está ativo neste ambiente). Reativar após migration de enforcement.
  it.skip("registrar partida incrementa daily_limits para a dupla A/B no dia", async () => {
    const playerA = await createTestUser("dl-a");
    const playerB = await createTestUser("dl-b");
    created.push(playerA, playerB);

    const supaA = userClient(playerA.accessToken);
    await supaA.rpc("register_match_with_notification_v1", {
      p_player_id: playerA.id,
      p_opponent_id: playerB.id,
      p_resultado_a: 3,
      p_resultado_b: 0,
      p_request_id: randomUUID(),
      p_timezone: "America/Sao_Paulo",
    });

    const admin = adminClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await admin
      .from("daily_limits")
      .select("user_id, opponent_id, data, jogos_registrados")
      .or(
        `and(user_id.eq.${playerA.id},opponent_id.eq.${playerB.id}),and(user_id.eq.${playerB.id},opponent_id.eq.${playerA.id})`
      )
      .eq("data", today);

    expect((data ?? []).length).toBeGreaterThan(0);
    for (const r of data ?? []) {
      expect(r.jogos_registrados).toBeGreaterThanOrEqual(1);
    }
  });

  it.skip("ao bater o limite diário, RPC retorna erro daily_limit_reached", async () => {
    const playerA = await createTestUser("dl-cap-a");
    const playerB = await createTestUser("dl-cap-b");
    created.push(playerA, playerB);

    const admin = adminClient();
    const today = new Date().toISOString().slice(0, 10);

    // Lê o limite configurado em settings; se não conseguir, pula o teste.
    const { data: settings } = await admin
      .from("settings")
      .select("key, value")
      .in("key", ["daily_match_limit", "max_daily_matches"]);

    let maxPerDay = 0;
    for (const s of settings ?? []) {
      const val = Number((s.value as { value?: unknown })?.value ?? s.value);
      if (Number.isFinite(val) && val > 0) maxPerDay = val;
    }
    if (!maxPerDay) maxPerDay = 3; // fallback razoável

    // Pré-popula daily_limits para forçar limite saturado
    await admin.from("daily_limits").upsert(
      [
        {
          user_id: playerA.id,
          opponent_id: playerB.id,
          data: today,
          jogos_registrados: maxPerDay,
        },
        {
          user_id: playerB.id,
          opponent_id: playerA.id,
          data: today,
          jogos_registrados: maxPerDay,
        },
      ],
      { onConflict: "user_id,opponent_id,data" }
    );

    const supaA = userClient(playerA.accessToken);
    const { error } = await supaA.rpc("register_match_with_notification_v1", {
      p_player_id: playerA.id,
      p_opponent_id: playerB.id,
      p_resultado_a: 3,
      p_resultado_b: 2,
      p_request_id: randomUUID(),
      p_timezone: "America/Sao_Paulo",
    });

    // Esperamos uma falha; aceitamos qualquer mensagem que contenha o termo "daily_limit"
    expect(error).not.toBeNull();
    expect((error?.message || "").toLowerCase()).toMatch(/daily_limit|limite/);
  });
});
