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
