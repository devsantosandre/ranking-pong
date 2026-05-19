import { describe, it, expect } from "vitest";
import { adminClient, anonClient, measureMs, SUPABASE_URL } from "../helpers/supabase";

describe("Conectividade — Supabase HML self-hosted", () => {
  it("URL pública responde sem erro de DNS/TLS", async () => {
    const res = await fetch(SUPABASE_URL);
    expect(res.status).toBeGreaterThanOrEqual(200);
    // Supabase root costuma devolver 401/404 — qualquer resposta abaixo de 500 indica que o Kong está vivo
    expect(res.status).toBeLessThan(500);
  });

  it("Auth gateway (/auth/v1/settings) responde 200", async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    // self-hosted devolve external/disable_signup/mailer_autoconfirm; só checa estrutura básica
    expect(typeof body).toBe("object");
  });

  it("PostgREST responde para tabela users com anon key", async () => {
    const supa = anonClient();
    const { error, status } = await supa.from("users").select("id").limit(1);
    // anon não tem sessão → RLS pode bloquear ou devolver lista vazia; o importante é não ser 401/403/500
    expect([200, 206]).toContain(status);
    expect(error).toBeNull();
  });

  it("service_role consegue listar tabelas críticas", async () => {
    const admin = adminClient();
    const tables = [
      "users",
      "matches",
      "match_sets",
      "match_metrics",
      "match_confirmation_state",
      "rating_transactions",
      "ranking_snapshots",
      "achievements",
      "user_achievements",
      "notifications",
      "push_subscriptions",
      "daily_limits",
      "live_updates",
      "news_posts",
      "settings",
      "admin_logs",
    ];
    for (const table of tables) {
      const { error, status } = await admin.from(table).select("*").limit(1);
      expect(error, `tabela ${table}: ${error?.message}`).toBeNull();
      expect(status, `tabela ${table} status`).toBeGreaterThanOrEqual(200);
      expect(status).toBeLessThan(300);
    }
  });

  it("latência de uma query simples fica abaixo de 1500ms (HML self-hosted)", async () => {
    const admin = adminClient();
    const { ms } = await measureMs(() => admin.from("users").select("id").limit(1));
    expect(ms).toBeLessThan(1500);
  });
});
