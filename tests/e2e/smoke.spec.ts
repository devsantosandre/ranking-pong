import { test, expect } from "@playwright/test";

test.describe("HML — smoke público", () => {
  test("/api/health responde 204", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(204);
  });

  test("/login carrega o formulário", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("acesso sem sessão redireciona para /login", async ({ page }) => {
    await page.goto("/ranking");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("manifest do PWA é servido", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    // Next.js pode servir como /manifest.webmanifest ou via app/manifest.ts
    expect([200, 304]).toContain(res.status());
  });
});
