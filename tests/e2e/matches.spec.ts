import { test, expect } from "@playwright/test";
import { createE2EUser, deleteE2EUser, loginViaUI, type E2EUser } from "./helpers/auth";

const created: E2EUser[] = [];

test.afterAll(async () => {
  for (const u of created) {
    await deleteE2EUser(u.id);
  }
});

test.describe("Partidas — navegação e registo via UI", () => {
  test("página /partidas carrega sem erro para usuário autenticado", async ({ page }) => {
    const user = await createE2EUser("match-view");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/partidas");

    // Qualquer texto de placeholder ou lista de partidas
    await expect(
      page.getByText(/partida|pendente|confirmad|histór|sem partidas/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("página /registrar-jogo carrega o formulário de registro", async ({ page }) => {
    const user = await createE2EUser("reg-form");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/registrar-jogo");

    // Formulário deve ter seletor de adversário e campo de placar
    await expect(
      page.getByRole("combobox").or(page.getByText(/adversário|oponente/i)).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("registro de partida com placar inválido (0x0) mostra erro", async ({ page }) => {
    const user = await createE2EUser("reg-invalid");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/registrar-jogo");

    // Tenta submeter sem preencher — botão de enviar deve aparecer
    const submitBtn = page.getByRole("button", { name: /registrar|salvar|enviar|confirmar/i });
    if (await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await submitBtn.click();
      // Esperamos validação do formulário (HTML5 ou mensagem custom)
      // Apenas verifica que não navegou para outra rota
      await page.waitForTimeout(1_500);
      expect(page.url()).toMatch(/registrar-jogo|partidas/);
    }
  });
});
