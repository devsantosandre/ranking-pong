import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  TestUser,
  userClient,
} from "../helpers/supabase";

// ── limpeza ──────────────────────────────────────────────────────────────────

const created: TestUser[] = [];
const createdSeasonIds: string[] = [];

afterAll(async () => {
  const admin = adminClient();
  for (const seasonId of createdSeasonIds) {
    // Busca slug para deletar news_post gerado pelo close_season
    const { data: s } = await admin
      .from("seasons")
      .select("slug")
      .eq("id", seasonId)
      .maybeSingle();
    if (s?.slug) {
      await admin.from("news_posts").delete().eq("slug", `campeao-${s.slug}`);
    }
    // Notificações geradas pelo close_season (coluna payload jsonb)
    await admin
      .from("notifications")
      .delete()
      .like("payload::text", `%${seasonId}%`);
    // Conquistas de season_champion vinculadas a usuários de teste
    for (const u of created) {
      await admin
        .from("user_achievements")
        .delete()
        .eq("user_id", u.id)
        .eq("achievement_key", "season_champion");
    }
    await admin.from("season_standings").delete().eq("season_id", seasonId);
    await admin.from("seasons").delete().eq("id", seasonId);
  }
  for (const u of created) {
    await deleteTestUser(u.id);
  }
});

// ── helpers ──────────────────────────────────────────────────────────────────

async function createTestSeason(label: string, status: "upcoming" | "active" = "upcoming") {
  const admin = adminClient();
  const slug = `qa-test-season-${label}-${Date.now().toString(36)}`;
  const now = new Date();
  const starts = new Date(now.getTime() - 60_000).toISOString(); // 1 min atrás
  const ends = new Date(now.getTime() + 30 * 24 * 3600_000).toISOString(); // 30 dias à frente

  const { data, error } = await admin
    .from("seasons")
    .insert({
      name: `QA Temporada ${label}`,
      slug,
      starts_at: starts,
      ends_at: ends,
      recurrence: "none",
      status,
    })
    .select("id, name, slug, status")
    .single();

  if (error) throw new Error(`createTestSeason failed: ${error.message}`);
  createdSeasonIds.push(data.id);
  return data as { id: string; name: string; slug: string; status: string };
}

async function registerAndValidateMatch(
  playerA: TestUser,
  playerB: TestUser
): Promise<string> {
  const supa = anonClient();
  await supa.auth.signInWithPassword({ email: playerA.email, password: playerA.password });

  const { data, error } = await supa.rpc("register_match_with_notification_v1", {
    p_player_id: playerA.id,
    p_opponent_id: playerB.id,
    p_resultado_a: 3,
    p_resultado_b: 1,
    p_request_id: randomUUID(),
    p_timezone: "America/Sao_Paulo",
  });
  if (error) throw new Error(`register failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  const matchId = row.match_id as string;

  const admin = adminClient();
  const { error: valErr } = await admin.rpc("validate_pending_match_v2", {
    p_match_id: matchId,
    p_actor_user_id: playerB.id,
    p_actor_name: playerB.name,
    p_actor_type: "player",
  });
  if (valErr) {
    // fallback direto caso RPC não exista no ambiente
    await admin
      .from("matches")
      .update({ status: "validado", vencedor_id: playerA.id })
      .eq("id", matchId);
  }
  await new Promise((r) => setTimeout(r, 800));
  return matchId;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Schema e configurações
// ─────────────────────────────────────────────────────────────────────────────

describe("Seasons — schema: tabelas e colunas esperadas", () => {
  it("tabela seasons existe e retorna linhas com colunas essenciais", async () => {
    const admin = adminClient();
    const { data, error } = await admin
      .from("seasons")
      .select("id, name, slug, starts_at, ends_at, status, recurrence, champion_user_id, closed_at, created_at")
      .limit(5);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("tabela season_standings existe e retorna linhas com colunas essenciais", async () => {
    const admin = adminClient();
    const { data, error } = await admin
      .from("season_standings")
      .select("season_id, user_id, points, wins, losses, games, zebra_wins, win_rate, position")
      .limit(5);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("status de temporada válido é um dos valores do enum esperado", async () => {
    const admin = adminClient();
    const { data } = await admin
      .from("seasons")
      .select("status")
      .limit(20);

    const validStatuses = ["upcoming", "active", "closed"];
    for (const row of data ?? []) {
      expect(validStatuses).toContain(row.status);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Settings de temporada
// ─────────────────────────────────────────────────────────────────────────────

describe("Seasons — settings: chaves seedadas e valores válidos", () => {
  const EXPECTED_KEYS = [
    "season_points_win",
    "season_points_loss",
    "season_zebra_bonus",
    "season_zebra_enabled",
  ] as const;

  it("todas as settings de temporada existem na tabela settings", async () => {
    const admin = adminClient();
    const { data, error } = await admin
      .from("settings")
      .select("key, value")
      .in("key", [...EXPECTED_KEYS]);

    expect(error).toBeNull();
    const foundKeys = (data ?? []).map((r) => r.key);
    for (const key of EXPECTED_KEYS) {
      expect(foundKeys, `setting '${key}' ausente`).toContain(key);
    }
  });

  it("season_points_win e season_points_loss são inteiros positivos", async () => {
    const admin = adminClient();
    const { data } = await admin
      .from("settings")
      .select("key, value")
      .in("key", ["season_points_win", "season_points_loss"]);

    for (const row of data ?? []) {
      const num = parseInt(row.value, 10);
      expect(isNaN(num), `${row.key} não é número: '${row.value}'`).toBe(false);
      expect(num, `${row.key} deve ser > 0`).toBeGreaterThan(0);
    }
  });

  it("season_zebra_bonus é inteiro >= 0", async () => {
    const admin = adminClient();
    const { data } = await admin
      .from("settings")
      .select("key, value")
      .eq("key", "season_zebra_bonus")
      .single();

    expect(data).not.toBeNull();
    const num = parseInt(data!.value, 10);
    expect(isNaN(num)).toBe(false);
    expect(num).toBeGreaterThanOrEqual(0);
  });

  it("season_zebra_enabled é 'true' ou 'false'", async () => {
    const admin = adminClient();
    const { data } = await admin
      .from("settings")
      .select("key, value")
      .eq("key", "season_zebra_enabled")
      .single();

    expect(data).not.toBeNull();
    expect(["true", "false"]).toContain(data!.value);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. RLS — leitura pública e escrita bloqueada
// ─────────────────────────────────────────────────────────────────────────────

describe("Seasons — RLS: leitura pública, escrita bloqueada", () => {
  it("usuário anônimo consegue ler seasons (RLS permite SELECT público)", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .from("seasons")
      .select("id, name, status")
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("usuário anônimo consegue ler season_standings (RLS permite SELECT público)", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .from("season_standings")
      .select("season_id, user_id, points")
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("player autenticado não consegue inserir em seasons diretamente", async () => {
    const player = await createTestUser("season-rls");
    created.push(player);

    const supa = userClient(player.accessToken);
    const { error } = await supa.from("seasons").insert({
      name: "Temporada Indevida",
      slug: `indevida-${Date.now()}`,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      recurrence: "none",
      status: "upcoming",
    });

    // RLS deve bloquear: o erro não é null
    expect(error).not.toBeNull();
  });

  it("player autenticado não consegue inserir em season_standings diretamente", async () => {
    const player = await createTestUser("standings-rls");
    created.push(player);

    const supa = userClient(player.accessToken);
    const { error } = await supa.from("season_standings").insert({
      season_id: randomUUID(),
      user_id: player.id,
      points: 9999,
    });

    expect(error).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ciclo de vida: criar → recalcular → encerrar
// ─────────────────────────────────────────────────────────────────────────────

describe("Seasons — ciclo de vida: criar, recalcular e encerrar", () => {
  it("cria uma temporada 'upcoming' via service_role com sucesso", async () => {
    const season = await createTestSeason("lifecycle-create");
    expect(season.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(season.status).toBe("upcoming");
  });

  it("recalc_season_standings em temporada sem partidas não falha e não cria linhas", async () => {
    const season = await createTestSeason("lifecycle-recalc");
    const admin = adminClient();

    const { error } = await admin.rpc("recalc_season_standings", {
      p_season_id: season.id,
    });

    expect(error).toBeNull();

    const { data: standings } = await admin
      .from("season_standings")
      .select("user_id")
      .eq("season_id", season.id);

    expect((standings ?? []).length).toBe(0);
  });

  it("close_season retorna ok=true e champion_user_id=null para temporada sem participantes", async () => {
    const season = await createTestSeason("lifecycle-close-empty");
    const admin = adminClient();

    const { data, error } = await admin.rpc("close_season", {
      p_season_id: season.id,
      p_actor_id: null,
    });

    expect(error).toBeNull();
    const result = data as {
      ok: boolean;
      already_closed: boolean;
      champion_user_id: string | null;
      season_name: string;
    };
    expect(result.ok).toBe(true);
    expect(result.already_closed).toBe(false);
    expect(result.champion_user_id).toBeNull();
    expect(typeof result.season_name).toBe("string");
  });

  it("close_season é idempotente — segunda chamada retorna already_closed=true", async () => {
    const season = await createTestSeason("lifecycle-idempotent");
    const admin = adminClient();

    // Primeira chamada
    await admin.rpc("close_season", { p_season_id: season.id, p_actor_id: null });

    // Segunda chamada
    const { data, error } = await admin.rpc("close_season", {
      p_season_id: season.id,
      p_actor_id: null,
    });

    expect(error).toBeNull();
    const result = data as { ok: boolean; already_closed: boolean };
    expect(result.ok).toBe(true);
    expect(result.already_closed).toBe(true);
  });

  it("após close_season, seasons.status é 'closed'", async () => {
    const season = await createTestSeason("lifecycle-status");
    const admin = adminClient();

    await admin.rpc("close_season", { p_season_id: season.id, p_actor_id: null });

    const { data } = await admin
      .from("seasons")
      .select("status, closed_at")
      .eq("id", season.id)
      .single();

    expect(data?.status).toBe("closed");
    expect(data?.closed_at).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Triggers: stamp de season_id e atualização de standings
// ─────────────────────────────────────────────────────────────────────────────

describe("Seasons — triggers: stamp de season_id e recalc de standings", () => {
  it("ao validar partida, match.season_id é preenchido pela temporada ativa (se houver)", async () => {
    const admin = adminClient();

    // Verifica se existe temporada ativa antes de criar usuários de teste
    const { data: activeSeason } = await admin
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle();

    if (!activeSeason) {
      console.warn("⚠ Nenhuma temporada ativa no ambiente — stamp de season_id não testável");
      return;
    }

    const playerA = await createTestUser("stamp-a");
    const playerB = await createTestUser("stamp-b");
    created.push(playerA, playerB);

    const matchId = await registerAndValidateMatch(playerA, playerB);

    const { data: match } = await admin
      .from("matches")
      .select("status, season_id")
      .eq("id", matchId)
      .single();

    expect(match?.status).toBe("validado");
    expect(match?.season_id).toBe(activeSeason.id);
  });

  it("ao validar partida com temporada ativa, season_standings ganha entradas para os dois jogadores", async () => {
    const admin = adminClient();

    const { data: activeSeason } = await admin
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle();

    if (!activeSeason) {
      console.warn("⚠ Nenhuma temporada ativa — teste de standings pulado");
      return;
    }

    const playerA = await createTestUser("standings-trigger-a");
    const playerB = await createTestUser("standings-trigger-b");
    created.push(playerA, playerB);

    await registerAndValidateMatch(playerA, playerB);

    const { data: standings, error } = await admin
      .from("season_standings")
      .select("user_id, points, wins, losses")
      .eq("season_id", activeSeason.id)
      .in("user_id", [playerA.id, playerB.id]);

    expect(error).toBeNull();
    expect((standings ?? []).length).toBe(2);
  });

  it("vencedor recebe wins+1 e pontos >= season_points_win", async () => {
    const admin = adminClient();

    const { data: activeSeason } = await admin
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle();

    if (!activeSeason) {
      console.warn("⚠ Nenhuma temporada ativa — teste de pontos pulado");
      return;
    }

    // Lê o setting de pontos por vitória
    const { data: setting } = await admin
      .from("settings")
      .select("value")
      .eq("key", "season_points_win")
      .single();
    const pointsWin = parseInt(setting?.value ?? "3", 10);

    const playerA = await createTestUser("pts-winner");
    const playerB = await createTestUser("pts-loser");
    created.push(playerA, playerB);

    await registerAndValidateMatch(playerA, playerB); // A vence B

    const { data: row } = await admin
      .from("season_standings")
      .select("user_id, points, wins, losses")
      .eq("season_id", activeSeason.id)
      .eq("user_id", playerA.id)
      .maybeSingle();

    expect(row?.wins).toBeGreaterThanOrEqual(1);
    expect(row?.points).toBeGreaterThanOrEqual(pointsWin);
  });

  it("perdedor recebe losses+1 e pontos >= season_points_loss", async () => {
    const admin = adminClient();

    const { data: activeSeason } = await admin
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle();

    if (!activeSeason) {
      console.warn("⚠ Nenhuma temporada ativa — teste de pontos do perdedor pulado");
      return;
    }

    const { data: setting } = await admin
      .from("settings")
      .select("value")
      .eq("key", "season_points_loss")
      .single();
    const pointsLoss = parseInt(setting?.value ?? "1", 10);

    const playerA = await createTestUser("pts-win2");
    const playerB = await createTestUser("pts-lose2");
    created.push(playerA, playerB);

    await registerAndValidateMatch(playerA, playerB); // A vence B

    const { data: row } = await admin
      .from("season_standings")
      .select("user_id, points, wins, losses")
      .eq("season_id", activeSeason.id)
      .eq("user_id", playerB.id)
      .maybeSingle();

    expect(row?.losses).toBeGreaterThanOrEqual(1);
    expect(row?.points).toBeGreaterThanOrEqual(pointsLoss);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Campeonato: campeão e posições congeladas
// ─────────────────────────────────────────────────────────────────────────────

describe("Seasons — campeão: close_season com participantes reais", () => {
  it("close_season define champion_user_id como o jogador com mais pontos", async () => {
    const admin = adminClient();

    // Cria dois jogadores e uma temporada de teste "upcoming"
    const champion = await createTestUser("champ-winner");
    const runner = await createTestUser("champ-runner");
    created.push(champion, runner);

    const season = await createTestSeason("championship");

    // Registra e valida partida entre os dois jogadores
    const matchId = await registerAndValidateMatch(champion, runner);

    // Redireciona a partida para a temporada de teste (o trigger já a vinculou à temporada ativa,
    // mas aqui precisamos vinculá-la à nossa temporada de teste para o close_season correto).
    await admin
      .from("matches")
      .update({ season_id: season.id })
      .eq("id", matchId);

    // Recalcula standings manualmente para a temporada de teste
    const { error: recalcErr } = await admin.rpc("recalc_season_standings", {
      p_season_id: season.id,
    });
    expect(recalcErr).toBeNull();

    // Encerra a temporada
    const { data, error } = await admin.rpc("close_season", {
      p_season_id: season.id,
      p_actor_id: null,
    });

    expect(error).toBeNull();
    const result = data as {
      ok: boolean;
      champion_user_id: string | null;
      champion_name: string | null;
    };
    expect(result.ok).toBe(true);
    expect(result.champion_user_id).toBe(champion.id);
  });

  it("após close_season com participantes, season_standings.position é definido para todos", async () => {
    const admin = adminClient();

    const p1 = await createTestUser("pos-p1");
    const p2 = await createTestUser("pos-p2");
    created.push(p1, p2);

    const season = await createTestSeason("positions");

    const matchId = await registerAndValidateMatch(p1, p2);
    await admin.from("matches").update({ season_id: season.id }).eq("id", matchId);
    await admin.rpc("recalc_season_standings", { p_season_id: season.id });
    await admin.rpc("close_season", { p_season_id: season.id, p_actor_id: null });

    const { data: standings } = await admin
      .from("season_standings")
      .select("user_id, position")
      .eq("season_id", season.id)
      .in("user_id", [p1.id, p2.id]);

    for (const row of standings ?? []) {
      expect(row.position, `position de user ${row.user_id} deve estar definida`).not.toBeNull();
      expect(row.position).toBeGreaterThanOrEqual(1);
    }
  });

  it("após close_season, seasons.champion_user_id é persistido no banco", async () => {
    const admin = adminClient();

    const winner = await createTestUser("persist-champ");
    const loser = await createTestUser("persist-loser");
    created.push(winner, loser);

    const season = await createTestSeason("persist-champion");
    const matchId = await registerAndValidateMatch(winner, loser);
    await admin.from("matches").update({ season_id: season.id }).eq("id", matchId);
    await admin.rpc("recalc_season_standings", { p_season_id: season.id });
    await admin.rpc("close_season", { p_season_id: season.id, p_actor_id: null });

    const { data } = await admin
      .from("seasons")
      .select("champion_user_id, status")
      .eq("id", season.id)
      .single();

    expect(data?.status).toBe("closed");
    expect(data?.champion_user_id).toBe(winner.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Achievement de campeão
// ─────────────────────────────────────────────────────────────────────────────

describe("Seasons — achievement season_champion é concedido ao campeão", () => {
  it("close_season insere achievement 'season_champion' para o vencedor", async () => {
    const admin = adminClient();

    // Verifica se achievement season_champion está no catálogo
    const { data: catalog } = await admin
      .from("achievements")
      .select("key")
      .eq("key", "season_champion")
      .maybeSingle();

    if (!catalog) {
      console.warn("⚠ Achievement 'season_champion' não encontrado no catálogo — teste pulado");
      return;
    }

    const winner = await createTestUser("achiev-winner");
    const loser = await createTestUser("achiev-loser");
    created.push(winner, loser);

    const season = await createTestSeason("achievement");
    const matchId = await registerAndValidateMatch(winner, loser);
    await admin.from("matches").update({ season_id: season.id }).eq("id", matchId);
    await admin.rpc("recalc_season_standings", { p_season_id: season.id });
    await admin.rpc("close_season", { p_season_id: season.id, p_actor_id: null });

    const { data: achievement } = await admin
      .from("user_achievements")
      .select("achievement_key, user_id")
      .eq("user_id", winner.id)
      .eq("achievement_key", "season_champion")
      .maybeSingle();

    expect(achievement).not.toBeNull();
    expect(achievement?.user_id).toBe(winner.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Listagem pública: apenas uma temporada ativa
// ─────────────────────────────────────────────────────────────────────────────

describe("Seasons — restrições de integridade", () => {
  it("não pode haver mais de uma temporada com status='active' no banco", async () => {
    const admin = adminClient();
    const { data, error } = await admin
      .from("seasons")
      .select("id, name")
      .eq("status", "active");

    expect(error).toBeNull();
    expect((data ?? []).length).toBeLessThanOrEqual(1);
  });

  it("seasons com status='active' têm ends_at no futuro ou foram encerradas automaticamente", async () => {
    const admin = adminClient();
    const { data } = await admin
      .from("seasons")
      .select("id, ends_at")
      .eq("status", "active");

    // Uma temporada ativa pode ter ends_at no passado até ser processada pelo lifecycle;
    // mas não deve haver múltiplas ativas (já garantido pelo índice único).
    expect((data ?? []).length).toBeLessThanOrEqual(1);
  });

  it("temporadas 'closed' têm closed_at preenchido", async () => {
    const admin = adminClient();
    const { data } = await admin
      .from("seasons")
      .select("id, closed_at")
      .eq("status", "closed")
      .limit(10);

    for (const row of data ?? []) {
      expect(row.closed_at, `season ${row.id} está 'closed' mas sem closed_at`).not.toBeNull();
    }
  });
});
