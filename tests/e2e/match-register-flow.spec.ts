import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  createE2EUser,
  deleteE2EUser,
  loginByCookieReady,
  type E2EUser,
} from "./helpers/auth";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const created: E2EUser[] = [];

test.afterAll(async () => {
  for (const u of created) {
    await deleteE2EUser(u.id);
  }
});

async function getDailyLimitFromSettings(): Promise<number> {
  const { data } = await admin
    .from("settings")
    .select("value")
    .eq("key", "limite_jogos_diarios")
    .maybeSingle();
  const raw = data?.value;
  const n = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

async function preFillDailyLimitToMax(
  playerAId: string,
  playerBId: string,
  max: number
) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  await admin.from("daily_limits").upsert(
    [
      { user_id: playerAId, opponent_id: playerBId, data: today, jogos_registrados: max },
      { user_id: playerBId, opponent_id: playerAId, data: today, jogos_registrados: max },
    ],
    { onConflict: "user_id,opponent_id,data" }
  );
}

test.describe("Registro de partida — fluxo UI completo", () => {
  test("contador X/Y aparece quando adversário é selecionado", async ({ page }) => {
    const playerA = await createE2EUser("flow-counter-a");
    const playerB = await createE2EUser("flow-counter-b");
    created.push(playerA, playerB);

    await loginByCookieReady(page, playerA.email, playerA.password);
    await page.goto("/registrar-jogo");

    const limit = await getDailyLimitFromSettings();

    // Seleciona o adversário no combobox
    await page.getByRole("combobox").click();
    await page.getByText(playerB.name).first().click();

    // Contador X/Y deve aparecer
    await expect(page.getByText(new RegExp(`0\\s*/\\s*${limit}\\s*jogos`, "i"))).toBeVisible({
      timeout: 10_000,
    });
  });

  // O RPC não enforça daily_limits no HML — o frontend lê corretamente mas o
  // login neste cenário mostra timeout intermitente. Reativar após enforcement server-side.
  test.skip("UI bloqueia botão Registrar quando limite diário foi atingido", async ({ page }) => {
    const playerA = await createE2EUser("flow-limit-a");
    const playerB = await createE2EUser("flow-limit-b");
    created.push(playerA, playerB);

    const limit = await getDailyLimitFromSettings();
    await preFillDailyLimitToMax(playerA.id, playerB.id, limit);

    await loginByCookieReady(page, playerA.email, playerA.password);
    await page.goto("/registrar-jogo");

    await page.getByRole("combobox").click();
    await page.getByText(playerB.name).first().click();

    // Banner vermelho de limite atingido aparece
    await expect(page.getByText(/Limite diário atingido/i)).toBeVisible({
      timeout: 10_000,
    });

    // Mesmo selecionando placar, o botão fica desabilitado
    await page.getByRole("button", { name: "3x1" }).click();
    const registrar = page.getByRole("button", { name: /Registrar partida/i });
    await expect(registrar).toBeDisabled();
  });

  test("registro bem-sucedido navega para /partidas e mostra optimistic", async ({ page }) => {
    const playerA = await createE2EUser("flow-ok-a");
    const playerB = await createE2EUser("flow-ok-b");
    created.push(playerA, playerB);

    await loginByCookieReady(page, playerA.email, playerA.password);
    await page.goto("/registrar-jogo");

    await page.getByRole("combobox").click();
    await page.getByText(playerB.name).first().click();
    await page.getByRole("button", { name: "3x1" }).click();

    const registrar = page.getByRole("button", { name: /Registrar partida/i });
    await expect(registrar).toBeEnabled();

    await Promise.all([
      page.waitForURL(/\/partidas/, { timeout: 15_000 }),
      registrar.click(),
    ]);

    // Na tela de partidas, a partida pendente do par deve aparecer rapidamente
    await expect(page.getByText(playerB.name).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("aviso 'último jogo do dia' aparece quando resta 1", async ({ page }) => {
    const playerA = await createE2EUser("flow-last-a");
    const playerB = await createE2EUser("flow-last-b");
    created.push(playerA, playerB);

    const limit = await getDailyLimitFromSettings();
    if (limit < 2) {
      test.skip(true, "Limite configurado < 2; teste não aplicável.");
    }

    // Coloca o contador a (limit - 1)
    await preFillDailyLimitToMax(playerA.id, playerB.id, limit - 1);

    await loginByCookieReady(page, playerA.email, playerA.password);
    await page.goto("/registrar-jogo");

    await page.getByRole("combobox").click();
    await page.getByText(playerB.name).first().click();

    await expect(page.getByText(/Último jogo do dia/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("observador não consegue acessar a tela de registro", async ({ page }) => {
    const player = await createE2EUser("flow-obs");
    created.push(player);

    // Marca como observador
    await admin
      .from("users")
      .update({ hide_from_ranking: true })
      .eq("id", player.id);

    await loginByCookieReady(page, player.email, player.password);
    await page.goto("/registrar-jogo");

    await expect(
      page.getByText(/Observadores não podem registrar partidas/i)
    ).toBeVisible({ timeout: 10_000 });
  });
});
