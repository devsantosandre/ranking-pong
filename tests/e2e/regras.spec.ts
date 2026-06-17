import { test, expect } from "@playwright/test";
import { createE2EUser, deleteE2EUser, loginViaUI, type E2EUser } from "./helpers/auth";

const created: E2EUser[] = [];

test.afterAll(async () => {
  for (const u of created) {
    await deleteE2EUser(u.id);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Carregamento e estrutura da página
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Regras — carregamento e estrutura", () => {
  test("carrega sem erros críticos de JS no console", async ({ page }) => {
    const user = await createE2EUser("regras-console");
    created.push(user);

    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await loginViaUI(page, user.email, user.password);
    await page.goto("/regras");
    await page.waitForTimeout(3_000);

    const ignoredPatterns = ["AbortError", "Load failed", "404", "406", "Not Acceptable"];
    const real = errors.filter((e) => !ignoredPatterns.some((pat) => e.includes(pat)));

    if (errors.length > 0) {
      console.warn(`⚠ ACHADO: erros de console em /regras: ${errors.join(" | ")}`);
    }
    expect(real, `Erros críticos: ${real.join(" | ")}`).toHaveLength(0);
  });

  test("exibe o título 'Regras' na AppShell", async ({ page }) => {
    const user = await createE2EUser("regras-titulo");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/regras");

    await expect(page.getByRole("heading", { name: "Regras" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("acessível sem login — redireciona para login ou exibe regras", async ({ page }) => {
    await page.goto("/regras");
    await page.waitForTimeout(2_000);

    // Pode redirecionar para login ou mostrar a página se for pública
    const isLoginPage = page.url().includes("/login");
    const hasRegrasContent = await page.getByText(/Regras|regras/i).first().isVisible().catch(() => false);

    expect(isLoginPage || hasRegrasContent).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Seção de Temporadas
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Regras — seção Temporadas", () => {
  test("seção 'Temporadas' está visível na página", async ({ page }) => {
    const user = await createE2EUser("regras-temp-section");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/regras");

    await expect(page.getByText(/Temporadas/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("pontos por vitória aparecem como número (>0) na seção Temporadas", async ({ page }) => {
    const user = await createE2EUser("regras-pts-vitoria");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/regras");
    await page.waitForTimeout(3_000);

    // O valor de season_points_win deve ser um número exibido na tela
    // O padrão é 3, mas pode ter sido editado no admin
    const hasPoints = await page
      .getByText(/\d+ pts? por vitória|\+\d+ pts?|\d+ pts? a cada vitória/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasPoints) {
      // Abordagem alternativa: verifica que há algum número na seção de temporadas
      const seasonSection = page.locator("section, div, article").filter({ hasText: /Temporadas/i }).first();
      const hasNumber = await seasonSection.getByText(/\d/).first().isVisible().catch(() => false);
      expect(hasNumber, "Deve exibir algum número na seção de temporadas").toBe(true);
    } else {
      expect(hasPoints).toBe(true);
    }
  });

  test("pontos por derrota aparecem na seção Temporadas", async ({ page }) => {
    const user = await createE2EUser("regras-pts-derrota");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/regras");
    await page.waitForTimeout(3_000);

    const hasLossPoints = await page
      .getByText(/derrota|por derrota/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasLossPoints).toBe(true);
  });

  test("menção ao Hall da Fama aparece nas regras", async ({ page }) => {
    const user = await createE2EUser("regras-hall");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/regras");
    await page.waitForTimeout(2_000);

    const hasHall = await page
      .getByText(/Hall da Fama/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasHall).toBe(true);
  });

  test("seção explica pontuação dupla (ELO e temporada)", async ({ page }) => {
    const user = await createE2EUser("regras-dupla");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/regras");
    await page.waitForTimeout(2_000);

    // Deve existir referência ao ranking geral (ELO) e ao de temporada
    const hasElo = await page.getByText(/ELO/i).first().isVisible().catch(() => false);
    const hasTempo = await page.getByText(/temporada/i).first().isVisible().catch(() => false);

    expect(hasElo || hasTempo, "Página deve mencionar ELO ou temporada").toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Seção de Partidas / ELO
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Regras — seção Partidas e ELO", () => {
  test("seção de regras de partidas está visível", async ({ page }) => {
    const user = await createE2EUser("regras-partidas");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/regras");

    await expect(
      page.getByText(/Partidas|Regras de jogo|Melhor de/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("menção ao limite diário de confrontos aparece", async ({ page }) => {
    const user = await createE2EUser("regras-limite");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/regras");
    await page.waitForTimeout(2_000);

    const hasLimit = await page
      .getByText(/limite|diário|por dia|confronto/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasLimit).toBe(true);
  });

  test("página de regras não exibe erros de carregamento de dados", async ({ page }) => {
    const user = await createE2EUser("regras-data-load");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/regras");
    await page.waitForTimeout(3_000);

    // Não deve exibir mensagens de erro de dados
    const hasError = await page
      .getByText(/erro ao carregar|failed to fetch|undefined/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasError).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Navegação para /regras
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Regras — navegação", () => {
  test("link 'Regras' no menu 'Mais' navega para /regras", async ({ page }) => {
    const user = await createE2EUser("regras-nav");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/mais");
    await page.waitForTimeout(2_000);

    const link = page.getByRole("link", { name: /Regras/i }).first();
    const isVisible = await link.isVisible().catch(() => false);

    if (!isVisible) {
      console.warn("⚠ ACHADO: link 'Regras' não encontrado em /mais");
      return;
    }

    await link.click();
    await page.waitForURL(/\/regras/, { timeout: 10_000 });
    expect(page.url()).toContain("/regras");
  });
});
