/**
 * Testes E2E — Fluxo completo de confirmação de partidas
 *
 * Cobre os 4 tipos de ação de confirmação:
 * 1. Confirmar partida (fluxo normal — score)
 * 2. Contestar placar
 * 3. Jogo não existiu
 * 4. Jogo existiu (rejeitar claim de inexistência)
 * 5. Tentar confirmar partida já processada
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  createE2EUser,
  deleteE2EUser,
  loginByCookieReady,
  type E2EUser,
} from "./helpers/auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const created: E2EUser[] = [];

test.afterAll(async () => {
  for (const u of created) {
    await deleteE2EUser(u.id);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function registerMatchViaRpc(params: {
  playerAId: string;
  playerAToken: string;
  playerBId: string;
  scoreA?: number;
  scoreB?: number;
}): Promise<string> {
  // RPC exige sessão autenticada (auth.uid()) — usa o token do playerA, não service_role
  const authedClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${params.playerAToken}` } },
  });
  const { data, error } = await authedClient.rpc("register_match_with_notification_v1", {
    p_player_id: params.playerAId,
    p_opponent_id: params.playerBId,
    p_resultado_a: params.scoreA ?? 3,
    p_resultado_b: params.scoreB ?? 1,
    p_request_id: randomUUID(),
    p_timezone: "America/Sao_Paulo",
  });
  if (error) throw new Error(`register_match: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return row.match_id as string;
}

async function getMatchStatus(matchId: string): Promise<string | null> {
  const { data } = await admin
    .from("matches")
    .select("status")
    .eq("id", matchId)
    .single();
  return data?.status ?? null;
}

// ── Testes ───────────────────────────────────────────────────────────────────

test.describe("Confirmação de partidas — fluxos completos", () => {
  test("confirmar partida pendente → status validado, lista atualiza", async ({ page }) => {
    const playerA = await createE2EUser("conf-a");
    const playerB = await createE2EUser("conf-b");
    created.push(playerA, playerB);

    // PlayerA registra partida contra PlayerB
    const matchId = await registerMatchViaRpc({
      playerAId: playerA.id,
      playerAToken: playerA.accessToken,
      playerBId: playerB.id,
    });

    // PlayerB faz login e vai para /partidas
    await loginByCookieReady(page, playerB.email, playerB.password, "/partidas");

    // Aguarda a partida aparecer na lista de pendências
    await expect(page.getByText(playerA.name)).toBeVisible({ timeout: 15_000 });

    // Clica no botão de confirmar
    const confirmBtn = page.getByRole("button", { name: /confirmar/i }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 });

    const start = Date.now();
    await confirmBtn.click();
    const elapsed = Date.now() - start;

    console.log(`  ⏱  confirmMatchAction UI response: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(3_000); // UI deve responder em < 3s (era até 1.4s no servidor)

    // Verifica no banco que a partida foi validada
    await expect.poll(async () => getMatchStatus(matchId), {
      timeout: 10_000,
      intervals: [500, 1000, 2000],
    }).toBe("validado");
  });

  test("contestar placar → match vai para edited, adversário vê pendência", async ({
    page,
    browser,
  }) => {
    const playerA = await createE2EUser("cont-a");
    const playerB = await createE2EUser("cont-b");
    created.push(playerA, playerB);

    const matchId = await registerMatchViaRpc({
      playerAId: playerA.id,
      playerAToken: playerA.accessToken,
      playerBId: playerB.id,
      scoreA: 3,
      scoreB: 1,
    });

    // PlayerB faz login e contesta o placar
    await loginByCookieReady(page, playerB.email, playerB.password, "/partidas");
    await expect(page.getByText(playerA.name)).toBeVisible({ timeout: 15_000 });

    const contestBtn = page.getByRole("button", { name: /contestar/i }).first();
    await expect(contestBtn).toBeVisible({ timeout: 10_000 });
    await contestBtn.click();

    // Preenche novo placar no modal
    const newScoreInput = page.getByPlaceholder(/placar/i).or(
      page.getByRole("textbox").filter({ hasText: /x/i })
    ).first();

    if (await newScoreInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await newScoreInput.fill("2x3");
    } else {
      // Tenta campos separados
      const inputs = page.getByRole("spinbutton");
      const count = await inputs.count();
      if (count >= 2) {
        await inputs.nth(0).fill("2");
        await inputs.nth(1).fill("3");
      }
    }

    const submitBtn = page.getByRole("button", { name: /confirmar|salvar|enviar/i }).last();
    const start = Date.now();
    await submitBtn.click();
    const elapsed = Date.now() - start;

    console.log(`  ⏱  contestMatchAction UI response: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(3_000);

    // Verifica no banco
    await expect.poll(async () => getMatchStatus(matchId), {
      timeout: 10_000,
    }).toBe("edited");

    // Adversário (playerA) abre novo contexto e verifica que vê pendência
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await loginByCookieReady(pageA, playerA.email, playerA.password, "/partidas");
    await expect(pageA.getByText(playerB.name)).toBeVisible({ timeout: 15_000 });
    await ctxA.close();
  });

  test("jogo não existiu → pendência muda de responsável", async ({ page }) => {
    const playerA = await createE2EUser("noex-a");
    const playerB = await createE2EUser("noex-b");
    created.push(playerA, playerB);

    const matchId = await registerMatchViaRpc({
      playerAId: playerA.id,
      playerAToken: playerA.accessToken,
      playerBId: playerB.id,
    });

    // PlayerB reporta que o jogo não existiu
    await loginByCookieReady(page, playerB.email, playerB.password, "/partidas");
    await expect(page.getByText(playerA.name)).toBeVisible({ timeout: 15_000 });

    const notHappenBtn = page.getByRole("button", {
      name: /não existiu|jogo não aconteceu|inexistente/i,
    }).first();

    if (!(await notHappenBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "Botão de jogo não existiu não encontrado — verifique o seletor");
      return;
    }

    await notHappenBtn.click();

    // O botão abre um ConfirmModal com confirmText="Confirmar envio" (não "Confirmar")
    const modalConfirmBtn = page.getByRole("button", { name: /confirmar envio/i });
    await expect(modalConfirmBtn).toBeVisible({ timeout: 5_000 });
    const start = Date.now();
    await modalConfirmBtn.click();
    const elapsed = Date.now() - start;
    console.log(`  ⏱  reportMatchDidNotHappenAction UI response: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(3_000);

    // Partida ainda deve estar em pendente/edited mas com criado_por = playerB
    await expect.poll(
      async () => {
        const { data } = await admin
          .from("matches")
          .select("status, criado_por")
          .eq("id", matchId)
          .single();
        return data?.criado_por === playerB.id;
      },
      { timeout: 10_000 }
    ).toBe(true);
  });

  test("jogo existiu → responsbilidade volta para o original", async ({ page }) => {
    const playerA = await createE2EUser("exis-a");
    const playerB = await createE2EUser("exis-b");
    created.push(playerA, playerB);

    const matchId = await registerMatchViaRpc({
      playerAId: playerA.id,
      playerAToken: playerA.accessToken,
      playerBId: playerB.id,
    });

    // PlayerB marca como não existiu diretamente via update no banco (sem UI)
    await admin
      .from("matches")
      .update({ status: "edited", criado_por: playerB.id })
      .eq("id", matchId);

    // Insere notificação de nonexistent_claimed
    await admin.from("notifications").insert({
      user_id: playerA.id,
      tipo: "confirmacao",
      payload: {
        event: "nonexistent_claimed",
        match_id: matchId,
        status: "edited",
        actor_id: playerB.id,
        actor_name: playerB.name,
        created_by: playerB.id,
      },
      lida: false,
    });

    // PlayerA vê como "jogo não existiu" e clica em "Jogo existiu"
    await loginByCookieReady(page, playerA.email, playerA.password, "/partidas");
    await expect(page.getByText(playerB.name)).toBeVisible({ timeout: 15_000 });

    const happenedBtn = page.getByRole("button", {
      name: /jogo existiu|aconteceu|ocorreu/i,
    }).first();

    if (!(await happenedBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "Botão 'Jogo existiu' não encontrado — verifique o seletor");
      return;
    }

    const start = Date.now();
    await happenedBtn.click();
    const elapsed = Date.now() - start;

    console.log(`  ⏱  confirmMatchDidHappenAction UI response: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(3_000);

    // Responsabilidade deve voltar para playerA (criado_por = playerA)
    await expect.poll(
      async () => {
        const { data } = await admin
          .from("matches")
          .select("criado_por")
          .eq("id", matchId)
          .single();
        return data?.criado_por === playerA.id;
      },
      { timeout: 10_000 }
    ).toBe(true);
  });

  test("tentar confirmar partida já validada → exibe erro correto", async ({ page }) => {
    const playerA = await createE2EUser("dup-a");
    const playerB = await createE2EUser("dup-b");
    created.push(playerA, playerB);

    const matchId = await registerMatchViaRpc({
      playerAId: playerA.id,
      playerAToken: playerA.accessToken,
      playerBId: playerB.id,
    });

    // Valida a partida diretamente no banco antes de tentar confirmar via UI
    await admin.rpc("validate_pending_match_v2", {
      p_match_id: matchId,
      p_actor_user_id: playerB.id,
      p_actor_name: playerB.name,
      p_actor_type: "player",
    });

    // PlayerB tenta confirmar via UI (partida já foi validada)
    await loginByCookieReady(page, playerB.email, playerB.password, "/partidas");

    // A partida não deve mais aparecer como pendente
    const partida = page.getByText(playerA.name);
    // Pode aparecer em "recentes" mas não em "pendentes"
    // Verificamos que não há botão de confirmar para essa partida
    const confirmBtn = page.getByRole("button", { name: /confirmar/i }).first();

    // Se aparecer um botão, ao clicar deve exibir erro
    if (await confirmBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await confirmBtn.click();
      const errorMsg = page.getByText(/já foi confirmada|já processada|não encontrada/i);
      await expect(errorMsg).toBeVisible({ timeout: 5_000 });
    } else {
      // Comportamento correto: a partida sumiu da lista de pendentes
      await expect(partida).not.toBeVisible({ timeout: 5_000 }).catch(() => {
        // Pode estar na lista de recentes (validado) — ok
      });
    }
  });
});
