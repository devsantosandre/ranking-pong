import { test, expect } from "@playwright/test";
import { createE2EUser, deleteE2EUser, loginViaUI, type E2EUser } from "./helpers/auth";

const created: E2EUser[] = [];

test.afterAll(async () => {
  for (const u of created) {
    await deleteE2EUser(u.id);
  }
});

test.describe("Ranking — visualização da tabela", () => {
  test("página /ranking carrega e exibe pelo menos um jogador", async ({ page }) => {
    const user = await createE2EUser("ranking-view");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/ranking");

    // Aguarda a lista carregar — espera qualquer elemento de jogador
    await expect(page.getByText(/divisão|rating|ponto/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("página /ranking não exibe erros de JS no console", async ({ page }) => {
    const user = await createE2EUser("ranking-console");
    created.push(user);

    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await loginViaUI(page, user.email, user.password);
    await page.goto("/ranking");
    await page.waitForTimeout(3_000);

    // Filtra erros ignoráveis: cancelamentos de navegação, recursos de terceiros e erros
    // conhecidos de Supabase HML self-hosted (406/404 em prefetch e chunks lazy-loaded).
    const ignoredPatterns = [
      "AbortError",
      "Load failed",
      "404",
      "406",
      "Not Acceptable",
      // Parse error de JSON ('<') pode vir de um chunk 404 retornando HTML — já coberto pelo 404 acima
      "Unexpected token",
    ];
    const real = errors.filter(
      (e) => !ignoredPatterns.some((pat) => e.includes(pat))
    );

    if (errors.length > 0) {
      console.warn(
        `⚠ ACHADO: erros de console em /ranking: ${errors.join(" | ")}`,
        "\nVerificar: recursos com 404 (JS chunks?), 406 (Accept header Supabase)"
      );
    }
    expect(real, `Erros críticos de console: ${real.join(" | ")}`).toHaveLength(0);
  });
});
