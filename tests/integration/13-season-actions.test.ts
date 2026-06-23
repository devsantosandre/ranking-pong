import { describe, it, expect, afterAll } from "vitest";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  TestUser,
  userClient,
} from "../helpers/supabase";

// ── limpeza ───────────────────────────────────────────────────────────────────

const created: TestUser[] = [];
const createdSeasonIds: string[] = [];
const createdNewsPostIds: string[] = [];

afterAll(async () => {
  const admin = adminClient();
  for (const id of createdNewsPostIds) {
    await admin.from("news_posts").delete().eq("id", id);
  }
  for (const id of createdSeasonIds) {
    // Limpa notícia gerada por close_season
    const { data: s } = await admin
      .from("seasons")
      .select("slug")
      .eq("id", id)
      .maybeSingle();
    if (s?.slug) {
      await admin.from("news_posts").delete().eq("slug", `campeao-${s.slug}`);
    }
    await admin.from("season_standings").delete().eq("season_id", id);
    await admin.from("seasons").delete().eq("id", id);
  }
  for (const u of created) {
    await deleteTestUser(u.id);
  }
});

// ── helper ────────────────────────────────────────────────────────────────────

async function createTestSeason(
  label: string,
  status: "upcoming" | "active" | "closed" = "upcoming",
  endsInFuture = true
) {
  const admin = adminClient();
  const slug = `qa-13-${label}-${Date.now().toString(36)}`;
  const starts = new Date(Date.now() - 60_000).toISOString();
  const ends = endsInFuture
    ? new Date(Date.now() + 30 * 24 * 3600_000).toISOString()
    : new Date(Date.now() - 60_000).toISOString(); // já expirada

  const { data, error } = await admin
    .from("seasons")
    .insert({
      name: `QA-13 ${label}`,
      slug,
      starts_at: starts,
      ends_at: ends,
      recurrence: "none",
      status,
    })
    .select("id, name, slug, status")
    .single();

  if (error) throw new Error(`createTestSeason(${label}) failed: ${error.message}`);
  createdSeasonIds.push(data.id);
  return data as { id: string; name: string; slug: string; status: string };
}

// ── 1. Ativação: upcoming → active ───────────────────────────────────────────

describe("Season actions — ativação de temporada upcoming", () => {
  it("UPDATE direto de upcoming → active funciona via service_role", async () => {
    const admin = adminClient();

    // Garante que não há temporada ativa antes de alterar
    const { data: active } = await admin
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle();

    if (active) {
      console.warn("⚠ Temporada ativa no ambiente — teste de ativação pulado para não conflitar");
      return;
    }

    const season = await createTestSeason("activate-ok");
    expect(season.status).toBe("upcoming");

    const { error } = await admin
      .from("seasons")
      .update({ status: "active" })
      .eq("id", season.id)
      .eq("status", "upcoming");

    expect(error).toBeNull();

    const { data } = await admin
      .from("seasons")
      .select("status")
      .eq("id", season.id)
      .single();

    expect(data?.status).toBe("active");

    // Reverte para não poluir demais os testes seguintes
    await admin.from("seasons").update({ status: "upcoming" }).eq("id", season.id);
  });

  it("índice único parcial impede segunda temporada ativa no banco", async () => {
    const admin = adminClient();

    const { data: existing } = await admin
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle();

    if (!existing) {
      console.warn("⚠ Nenhuma temporada ativa — teste de índice único parcial condicionado");
      // Ainda assim verifica que apenas 1 linha active é permitida
      const season = await createTestSeason("idx-single");
      await admin.from("seasons").update({ status: "active" }).eq("id", season.id);

      // Tenta inserir segunda ativa
      const slug2 = `qa-idx2-${Date.now().toString(36)}`;
      const { error } = await admin.from("seasons").insert({
        name: "QA IDX Segunda Ativa",
        slug: slug2,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 86_400_000).toISOString(),
        recurrence: "none",
        status: "active",
      });

      expect(error, "Índice único parcial deve rejeitar segunda ativa").not.toBeNull();

      // Reverte
      await admin.from("seasons").update({ status: "upcoming" }).eq("id", season.id);
      await admin.from("seasons").delete().like("slug", "qa-idx2-%");
      return;
    }

    // Já existe ativa — tenta inserir mais uma
    const slug = `qa-double-${Date.now().toString(36)}`;
    const { error } = await admin.from("seasons").insert({
      name: "QA Double Active",
      slug,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      recurrence: "none",
      status: "active",
    });

    expect(error, "Índice único parcial deve rejeitar segunda ativa").not.toBeNull();
  });

  it("temporada activated via UPDATE tem admin_log inserível pelo service_role", async () => {
    const admin = adminClient();

    const season = await createTestSeason("activate-log");
    const actor = await createTestUser("activate-log-actor");
    created.push(actor);

    const { error } = await admin.from("admin_logs").insert({
      admin_id: actor.id,
      admin_role: "admin",
      action: "season_activated",
      action_description: `Temporada "${season.name}" ativada manualmente (teste).`,
      target_type: "season",
      target_id: season.id,
      target_name: season.name,
      old_value: { status: "upcoming" },
      new_value: { status: "active" },
    });

    expect(error).toBeNull();
  });
});

// ── 2. Reabertura: closed → active ───────────────────────────────────────────

describe("Season actions — reabertura de temporada encerrada", () => {
  it("reabertura limpa champion_user_id e closed_at no banco", async () => {
    const admin = adminClient();

    // O índice seasons_single_active_idx permite apenas UMA temporada ativa.
    // Libera o slot fechando qualquer ativa remanescente (higiene do banco de
    // teste) para que ativar/reabrir a temporada de teste seja determinístico.
    await admin
      .from("seasons")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("status", "active");

    const season = await createTestSeason("reopen-clean");

    await admin.from("seasons").update({ status: "active" }).eq("id", season.id);
    await admin.rpc("close_season", { p_season_id: season.id, p_actor_id: null });

    const { data: closed } = await admin
      .from("seasons")
      .select("status, closed_at")
      .eq("id", season.id)
      .single();

    expect(closed?.status).toBe("closed");
    expect(closed?.closed_at).not.toBeNull();

    // Reabre
    const { error } = await admin
      .from("seasons")
      .update({ status: "active", champion_user_id: null, closed_at: null })
      .eq("id", season.id);

    expect(error).toBeNull();

    const { data: reopened } = await admin
      .from("seasons")
      .select("status, champion_user_id, closed_at")
      .eq("id", season.id)
      .single();

    expect(reopened?.status).toBe("active");
    expect(reopened?.champion_user_id).toBeNull();
    expect(reopened?.closed_at).toBeNull();

    // Fecha de novo para limpeza ficar consistente
    await admin.rpc("close_season", { p_season_id: season.id, p_actor_id: null });
  });

  it("reabertura consegue zerar position em season_standings", async () => {
    const admin = adminClient();

    const p1 = await createTestUser("reopen-pos-p1");
    const p2 = await createTestUser("reopen-pos-p2");
    created.push(p1, p2);

    const season = await createTestSeason("reopen-positions");

    // Insere standings com posições congeladas
    await admin.from("season_standings").upsert([
      { season_id: season.id, user_id: p1.id, points: 9, wins: 3, losses: 0, games: 3, position: 1 },
      { season_id: season.id, user_id: p2.id, points: 3, wins: 1, losses: 2, games: 3, position: 2 },
    ]);

    // Simula reabertura: zera posições
    const { error } = await admin
      .from("season_standings")
      .update({ position: null })
      .eq("season_id", season.id);

    expect(error).toBeNull();

    const { data } = await admin
      .from("season_standings")
      .select("user_id, position")
      .eq("season_id", season.id)
      .in("user_id", [p1.id, p2.id]);

    for (const row of data ?? []) {
      expect(row.position, `position de user ${row.user_id} deve ser null após reabertura`).toBeNull();
    }
  });

  it("notícia de campeão (slug campeao-*) pode ser deletada pelo service_role", async () => {
    const admin = adminClient();

    const slug = `campeao-qa-test-reopen-${Date.now().toString(36)}`;
    const { data, error } = await admin.from("news_posts").insert({
      title: "QA Campeão Reopen",
      slug,
      resumo: "Notícia de campeão para teste de reabertura.",
      tipo: "temporada",
      published_at: new Date().toISOString(),
    }).select("id").single();

    expect(error).toBeNull();
    if (!data) return;

    const { error: delErr } = await admin.from("news_posts").delete().eq("slug", slug);
    expect(delErr).toBeNull();
  });
});

// ── 3. Notícias de temporada ──────────────────────────────────────────────────

describe("Season actions — notícias tipo='temporada'", () => {
  it("insere notícia com tipo='temporada' sem erro via service_role", async () => {
    const admin = adminClient();
    const slug = `qa-news-temp-${Date.now().toString(36)}`;

    const { data, error } = await admin.from("news_posts").insert({
      title: "QA Notícia Temporada",
      slug,
      resumo: "Teste de notícia de tipo temporada.",
      tipo: "temporada",
      published_at: new Date().toISOString(),
    }).select("id").single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    createdNewsPostIds.push(data!.id);
  });

  it("notícia tipo='temporada' é visível na listagem de news_posts", async () => {
    const admin = adminClient();
    const slug = `qa-news-list-${Date.now().toString(36)}`;

    const { data: inserted } = await admin.from("news_posts").insert({
      title: "QA Notícia List",
      slug,
      resumo: "Visível na listagem.",
      tipo: "temporada",
      published_at: new Date().toISOString(),
    }).select("id").single();

    if (!inserted) return;
    createdNewsPostIds.push(inserted.id);

    const { data: found } = await admin
      .from("news_posts")
      .select("id, tipo")
      .eq("id", inserted.id)
      .single();

    expect(found?.tipo).toBe("temporada");
  });

  it("player autenticado não consegue deletar notícia de temporada (RLS)", async () => {
    const admin = adminClient();
    const player = await createTestUser("news-rls");
    created.push(player);

    const slug = `qa-news-rls-${Date.now().toString(36)}`;
    const { data } = await admin.from("news_posts").insert({
      title: "QA RLS News",
      slug,
      resumo: "Bloqueada por RLS.",
      tipo: "temporada",
      published_at: new Date().toISOString(),
    }).select("id").single();

    if (!data) return;
    createdNewsPostIds.push(data.id);

    const supa = userClient(player.accessToken);
    await supa.from("news_posts").delete().eq("id", data.id);

    // RLS em DELETE funciona como filtro de linhas, não como erro: o player
    // simplesmente afeta 0 linhas (sem erro). Verificamos que a notícia
    // continua existindo — ou seja, a RLS bloqueou a exclusão.
    const { data: still } = await admin
      .from("news_posts")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();

    expect(still?.id).toBe(data.id);
  });
});

// ── 4. Lifecycle: temporada expirada ─────────────────────────────────────────

describe("Season actions — lifecycle de temporada expirada", () => {
  it("close_season funciona para temporada com ends_at no passado (simula enforceSeasonLifecycle)", async () => {
    const admin = adminClient();

    const { data: active } = await admin
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle();

    if (active) {
      console.warn("⚠ Temporada ativa no ambiente — teste de lifecycle expirado condicionado");
      return;
    }

    // Cria temporada com ends_at no passado
    const slug = `qa-expired-${Date.now().toString(36)}`;
    const { data: season, error: insErr } = await admin.from("seasons").insert({
      name: "QA Temporada Expirada",
      slug,
      starts_at: new Date(Date.now() - 10 * 24 * 3600_000).toISOString(),
      ends_at: new Date(Date.now() - 60_000).toISOString(),
      recurrence: "none",
      status: "active",
    }).select("id, slug").single();

    if (insErr || !season) throw new Error(`Falha ao criar temporada expirada: ${insErr?.message}`);
    createdSeasonIds.push(season.id);

    // Simula enforceSeasonLifecycle chamando close_season
    const { data, error } = await admin.rpc("close_season", {
      p_season_id: season.id,
      p_actor_id: null,
    });

    expect(error).toBeNull();
    const result = data as { ok: boolean; already_closed: boolean };
    expect(result.ok).toBe(true);
    expect(result.already_closed).toBe(false);

    const { data: closed } = await admin
      .from("seasons")
      .select("status")
      .eq("id", season.id)
      .single();

    expect(closed?.status).toBe("closed");

    // Limpeza da notícia gerada pelo close_season
    if (season.slug) {
      await admin.from("news_posts").delete().eq("slug", `campeao-${season.slug}`);
    }
  });

  it("recalc_season_standings em temporada upcoming não falha mesmo sem partidas", async () => {
    const admin = adminClient();
    const season = await createTestSeason("lifecycle-recalc-empty");

    const { error } = await admin.rpc("recalc_season_standings", {
      p_season_id: season.id,
    });

    expect(error).toBeNull();
  });
});

// ── 5. Admin logs de temporada ────────────────────────────────────────────────

describe("Season actions — admin_logs de temporada", () => {
  it("admin_log com action='season_closed_manual' pode ser inserido", async () => {
    const admin = adminClient();
    const actor = await createTestUser("log-close-actor");
    created.push(actor);
    const season = await createTestSeason("log-close");

    const { error } = await admin.from("admin_logs").insert({
      admin_id: actor.id,
      admin_role: "admin",
      action: "season_closed_manual",
      action_description: `Temporada "${season.name}" encerrada manualmente (teste).`,
      target_type: "season",
      target_id: season.id,
      target_name: season.name,
      old_value: { status: "active" },
      new_value: { status: "closed" },
    });

    expect(error).toBeNull();
  });

  it("admin_log com action='season_reopened' pode ser inserido", async () => {
    const admin = adminClient();
    const actor = await createTestUser("log-reopen-actor");
    created.push(actor);
    const season = await createTestSeason("log-reopen");

    const { error } = await admin.from("admin_logs").insert({
      admin_id: actor.id,
      admin_role: "admin",
      action: "season_reopened",
      action_description: `Temporada "${season.name}" reaberta (teste).`,
      target_type: "season",
      target_id: season.id,
      target_name: season.name,
      old_value: { status: "closed" },
      new_value: { status: "active" },
    });

    expect(error).toBeNull();
  });

  it("player autenticado não consegue inserir em admin_logs (RLS)", async () => {
    const admin = adminClient();
    const player = await createTestUser("log-rls");
    created.push(player);

    const supa = userClient(player.accessToken);
    const { error } = await supa.from("admin_logs").insert({
      admin_id: player.id,
      admin_role: "player",
      action: "season_activated",
    });

    expect(error).not.toBeNull();
  });
});
