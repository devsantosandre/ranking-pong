import { test, expect } from "@playwright/test";
import { createE2EUser, deleteE2EUser, loginViaUI, type E2EUser } from "./helpers/auth";

const created: E2EUser[] = [];

test.afterAll(async () => {
  for (const u of created) {
    await deleteE2EUser(u.id);
  }
});

test.describe("Perfil — visualização e edição", () => {
  test("página /perfil exibe o nome do usuário logado", async ({ page }) => {
    const user = await createE2EUser("perfil-view");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/perfil");

    // O nome "QA E2E" deverá aparecer em algum elemento da página de perfil
    await expect(page.getByText(/QA E2E/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("página /perfil mostra rating inicial (250)", async ({ page }) => {
    const user = await createE2EUser("perfil-rating");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/perfil");

    // Rating inicial é 250 para novos usuários
    await expect(page.getByText("250").first()).toBeVisible({ timeout: 15_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Últimos Jogos — abas Geral e Temporada
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Perfil — abas Geral e Temporada em Últimos Jogos", () => {
  test("ambas as abas 'Geral' e 'Temporada' são visíveis em Últimos Jogos", async ({ page }) => {
    const user = await createE2EUser("perfil-tabs-visible");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/perfil");

    await expect(page.getByRole("tab", { name: "Geral" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("tab", { name: "Temporada" })).toBeVisible({ timeout: 5_000 });
  });

  test("aba 'Geral' está selecionada por padrão", async ({ page }) => {
    const user = await createE2EUser("perfil-tab-default");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/perfil");

    const tab = page.getByRole("tab", { name: "Geral" });
    await expect(tab).toBeVisible({ timeout: 15_000 });

    const ariaSelected = await tab.getAttribute("aria-selected");
    const dataState = await tab.getAttribute("data-state");
    expect(ariaSelected === "true" || dataState === "active").toBe(true);
  });

  test("aba 'Geral' exibe 'pts ELO' ou mensagem de sem partidas", async ({ page }) => {
    const user = await createE2EUser("perfil-geral-content");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/perfil");

    await page.waitForTimeout(3_000);

    const hasEloContent = await page
      .getByText(/pts ELO|Nenhum jogo registrado ainda|Sem partidas/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasEloContent).toBe(true);
  });

  test("aba 'Temporada' exibe pontos amber ou mensagem de sem temporada ativa", async ({ page }) => {
    const user = await createE2EUser("perfil-temporada-content");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/perfil");

    await page.getByRole("tab", { name: "Temporada" }).click();
    await page.waitForTimeout(3_000);

    const hasContent = await page
      .getByText(/pts temp\.|Nenhuma temporada ativa|Nenhum jogo nesta temporada|sem temporada/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasContent).toBe(true);
  });

  test("perfil não exibe erros críticos de JS no console", async ({ page }) => {
    const user = await createE2EUser("perfil-console");
    created.push(user);

    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await loginViaUI(page, user.email, user.password);
    await page.goto("/perfil");
    await page.waitForTimeout(3_000);

    const ignoredPatterns = ["AbortError", "Load failed", "404", "406", "Not Acceptable", "Unexpected token"];
    const real = errors.filter((e) => !ignoredPatterns.some((pat) => e.includes(pat)));

    if (errors.length > 0) {
      console.warn(`⚠ ACHADO: erros de console em /perfil: ${errors.join(" | ")}`);
    }
    expect(real, `Erros críticos: ${real.join(" | ")}`).toHaveLength(0);
  });
});
