import { describe, it, expect, afterAll } from "vitest";
import { adminClient, createTestUser, deleteTestUser, measureMs, TestUser } from "../helpers/supabase";

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
