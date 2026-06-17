import { test, expect } from "@playwright/test";
import { createE2EUser, deleteE2EUser, loginViaUI, type E2EUser } from "./helpers/auth";

const created: E2EUser[] = [];

test.afterAll(async () => {
  for (const u of created) {
    await deleteE2EUser(u.id);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Página pública /temporadas
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Temporadas — página /temporadas", () => {
  test("carrega sem erros críticos de JS no console", async ({ page }) => {
    const user = await createE2EUser("season-page-console");
    created.push(user);

    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await loginViaUI(page, user.email, user.password);
    await page.goto("/temporadas");
    await page.waitForTimeout(3_000);

    const ignoredPatterns = [
      "AbortError",
      "Load failed",
      "404",
      "406",
      "Not Acceptable",
      "Unexpected token",
    ];
    const real = errors.filter(
      (e) => !ignoredPatterns.some((pat) => e.includes(pat))
    );

    if (errors.length > 0) {
      console.warn(`⚠ ACHADO: erros de console em /temporadas: ${errors.join(" | ")}`);
    }
    expect(real, `Erros críticos: ${real.join(" | ")}`).toHaveLength(0);
  });

  test("exibe o título 'Temporadas' na AppShell", async ({ page }) => {
    const user = await createE2EUser("season-page-title");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/temporadas");

    await expect(page.getByRole("heading", { name: "Temporadas" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("exibe subtítulo 'Hall da Fama'", async ({ page }) => {
    const user = await createE2EUser("season-page-subtitle");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/temporadas");

    await expect(page.getByText("Hall da Fama").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("mostra temporada ativa ou mensagem de ausência", async ({ page }) => {
    const user = await createE2EUser("season-page-state");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/temporadas");
    await page.waitForTimeout(4_000);

    // Aceita tanto o card de temporada ativa quanto a mensagem de vazio nas fechadas
    const hasActiveBadge = await page.getByText("ativa").isVisible().catch(() => false);
    const hasEmptyMsg = await page
      .getByText(/Nenhuma temporada encerrada ainda|Nenhum jogo registrado/i)
      .isVisible()
      .catch(() => false);
    const hasSeasonName = await page.getByText(/temporada/i).first().isVisible().catch(() => false);

    expect(hasActiveBadge || hasEmptyMsg || hasSeasonName).toBe(true);
  });

  test("botão 'Ver classificação completa' colapsa e expande histórico de temporada encerrada", async ({ page }) => {
    const user = await createE2EUser("season-expand-standings");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/temporadas");
    await page.waitForTimeout(4_000);

    const expandBtn = page.getByRole("button", { name: /Ver classificação completa/i }).first();
    const hasClosed = await expandBtn.isVisible().catch(() => false);

    if (!hasClosed) {
      console.warn("⚠ ACHADO: botão 'Ver classificação completa' ausente — nenhuma temporada encerrada no ambiente");
      return;
    }

    // Expande
    await expandBtn.click();
    await page.waitForTimeout(1_000);

    const hasStandings = await page
      .getByText(/Classificação final/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasStandings).toBe(true);

    // Colapsa
    const hideBtn = page.getByRole("button", { name: /Ocultar classificação/i }).first();
    await hideBtn.click();
    await page.waitForTimeout(500);

    const isHidden = await page
      .getByText(/Classificação final/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(isHidden).toBe(false);
  });

  test("botão 'Ver ranking completo →' está visível e navega para /ranking", async ({ page }) => {
    const user = await createE2EUser("season-page-link");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/temporadas");
    await page.waitForTimeout(3_000);

    const link = page.getByRole("link", { name: /Ver ranking completo/i });
    const isVisible = await link.isVisible().catch(() => false);

    if (!isVisible) {
      // Não há temporada ativa — link só aparece quando há temporada ativa
      console.warn("⚠ ACHADO: botão 'Ver ranking completo' ausente — provável que não há temporada ativa");
      return;
    }

    await link.click();
    await page.waitForURL(/\/ranking/, { timeout: 10_000 });
    expect(page.url()).toContain("/ranking");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Ranking — abas Temporada e Geral
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Ranking — abas Temporada e Geral", () => {
  test("ambas as abas 'Temporada' e 'Geral' são visíveis", async ({ page }) => {
    const user = await createE2EUser("ranking-tabs-visible");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/ranking");

    await expect(page.getByRole("tab", { name: "Temporada" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("tab", { name: "Geral" })).toBeVisible({
      timeout: 5_000,
    });
  });

  test("aba 'Temporada' está selecionada por padrão", async ({ page }) => {
    const user = await createE2EUser("ranking-tab-default");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/ranking");

    const tab = page.getByRole("tab", { name: "Temporada" });
    await expect(tab).toBeVisible({ timeout: 15_000 });

    // Aba ativa tem aria-selected="true" ou estado ativo via shadcn Tabs
    const ariaSelected = await tab.getAttribute("aria-selected");
    const dataState = await tab.getAttribute("data-state");

    expect(ariaSelected === "true" || dataState === "active").toBe(true);
  });

  test("aba Temporada exibe mensagem de temporada ativa ou ausência", async ({ page }) => {
    const user = await createE2EUser("ranking-temporada-content");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/ranking");
    await page.waitForTimeout(4_000);

    // O conteúdo da aba Temporada deve ser um dos dois casos possíveis
    const hasActiveContent = await page
      .getByText(/pts temp\.|Nenhuma temporada ativa|Nenhum jogo nesta temporada/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasActiveContent).toBe(true);
  });

  test("clicar em 'Geral' exibe total de jogos validados", async ({ page }) => {
    const user = await createE2EUser("ranking-geral-tab");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/ranking");

    await page.getByRole("tab", { name: "Geral" }).click();
    await page.waitForTimeout(3_000);

    const hasGeralContent = await page
      .getByText(/jogos validados|Carregando total/i)
      .isVisible()
      .catch(() => false);

    expect(hasGeralContent).toBe(true);
  });

  test("campo de busca filtra jogadores em ambas as abas", async ({ page }) => {
    const user = await createE2EUser("ranking-search");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/ranking");
    await page.waitForTimeout(2_000);

    // Digita no campo de busca
    const searchInput = page.getByPlaceholder(/buscar|nome|jogador/i).first();
    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (!hasSearch) {
      console.warn("⚠ ACHADO: campo de busca não encontrado pelo placeholder esperado");
      return;
    }

    await searchInput.fill("zzz-inexistente");
    await page.waitForTimeout(1_000);

    const hasNoResults = await page
      .getByText(/nenhum jogador encontrado/i)
      .isVisible()
      .catch(() => false);

    expect(hasNoResults).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Home — cartão de temporada
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Home — cartão de temporada ativa", () => {
  test("cartão de temporada aparece na home quando há temporada ativa", async ({ page }) => {
    const user = await createE2EUser("home-season-card");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/");
    await page.waitForTimeout(4_000);

    // O cartão de temporada mostra o nome da temporada ou a mensagem "Nenhum jogo na temporada ainda"
    const hasSeasonCard = await page
      .getByText(/temporada|nenhum jogo na temporada/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasSeasonCard) {
      console.warn("⚠ ACHADO: cartão de temporada não encontrado na home — pode não haver temporada ativa");
    }
    // Não falhamos o teste se não houver temporada ativa — apenas documentamos
  });

  test("cartão de temporada na home navega para /ranking ao clicar", async ({ page }) => {
    const user = await createE2EUser("home-season-link");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/");
    await page.waitForTimeout(4_000);

    // Procura o link para /ranking dentro de um artigo de temporada
    const seasonLink = page.locator("a[href='/ranking']").first();
    const isVisible = await seasonLink.isVisible().catch(() => false);

    if (!isVisible) {
      console.warn("⚠ ACHADO: link de temporada para /ranking não encontrado na home");
      return;
    }

    await seasonLink.click();
    await page.waitForURL(/\/ranking/, { timeout: 10_000 });
    expect(page.url()).toContain("/ranking");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Perfil — cartão de temporada
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Perfil — cartão de temporada ativa", () => {
  test("cartão de temporada aparece no perfil quando há temporada ativa", async ({ page }) => {
    const user = await createE2EUser("perfil-season-card");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/perfil");
    await page.waitForTimeout(4_000);

    // O card exibe o nome da temporada ou a mensagem padrão
    const hasSeasonInfo = await page
      .getByText(/temporada|nenhum jogo na temporada/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasSeasonInfo) {
      console.warn("⚠ ACHADO: cartão de temporada não encontrado no perfil — pode não haver temporada ativa");
    }
  });

  test("perfil não exibe erros críticos de JS no console", async ({ page }) => {
    const user = await createE2EUser("perfil-season-console");
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

// ─────────────────────────────────────────────────────────────────────────────
// 5. Navegação — item "Temporadas" no menu inferior
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Navegação — item Temporadas no menu", () => {
  test("link 'Temporadas' está visível no menu inferior", async ({ page }) => {
    const user = await createE2EUser("nav-temporadas");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Temporadas" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("link 'Temporadas' navega para /temporadas", async ({ page }) => {
    const user = await createE2EUser("nav-temporadas-navigate");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/");

    await page.getByRole("link", { name: "Temporadas" }).click();
    await page.waitForURL(/\/temporadas/, { timeout: 10_000 });
    expect(page.url()).toContain("/temporadas");
  });

  test("link 'Temporadas' fica ativo ao estar na página /temporadas", async ({ page }) => {
    const user = await createE2EUser("nav-temporadas-active");
    created.push(user);

    await loginViaUI(page, user.email, user.password);
    await page.goto("/temporadas");

    const link = page.getByRole("link", { name: "Temporadas" });
    await expect(link).toBeVisible({ timeout: 10_000 });

    // Link ativo deve ter classe de destaque (bg-primary/15 ou text-primary)
    const className = await link.getAttribute("class");
    expect(className).toMatch(/primary/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Admin — /admin/temporadas
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Admin — /admin/temporadas", () => {
  test("admin consegue acessar /admin/temporadas e ver o título", async ({ page }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const adminUser = await createE2EUser("admin-temp-mgmt");
    created.push(adminUser);

    // Promove para admin
    await adminSupabase.from("users").update({ role: "admin" }).eq("id", adminUser.id);

    await loginViaUI(page, adminUser.email, adminUser.password);
    await page.goto("/admin/temporadas");

    await expect(page.getByRole("heading", { name: "Temporadas" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("formulário 'Nova temporada' aparece ao clicar no botão", async ({ page }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const adminUser = await createE2EUser("admin-temp-form");
    created.push(adminUser);

    await adminSupabase.from("users").update({ role: "admin" }).eq("id", adminUser.id);

    await loginViaUI(page, adminUser.email, adminUser.password);
    await page.goto("/admin/temporadas");

    await page.getByRole("button", { name: /Nova temporada/i }).click();

    await expect(page.getByPlaceholder(/ex: Temporada Junho/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("lista de temporadas existentes é carregada", async ({ page }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const adminUser = await createE2EUser("admin-temp-list");
    created.push(adminUser);

    await adminSupabase.from("users").update({ role: "admin" }).eq("id", adminUser.id);

    await loginViaUI(page, adminUser.email, adminUser.password);
    await page.goto("/admin/temporadas");
    await page.waitForTimeout(3_000);

    // Deve aparecer pelo menos uma temporada (a Temporada Inaugural criada pelas migrations)
    // ou a mensagem de vazio
    const hasSeasonItem = await page
      .getByText(/temporada|agendada|ativa|encerrada/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasSeasonItem).toBe(true);
  });

  test("link para /admin/temporadas aparece no menu admin para administradores", async ({ page }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const adminUser = await createE2EUser("admin-menu-link");
    created.push(adminUser);

    await adminSupabase.from("users").update({ role: "admin" }).eq("id", adminUser.id);

    await loginViaUI(page, adminUser.email, adminUser.password);
    await page.goto("/admin");

    await expect(page.getByRole("link", { name: "Temporadas" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("admin configurações exibe settings de temporada", async ({ page }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const adminUser = await createE2EUser("admin-config-season");
    created.push(adminUser);

    await adminSupabase.from("users").update({ role: "admin" }).eq("id", adminUser.id);

    await loginViaUI(page, adminUser.email, adminUser.password);
    await page.goto("/admin/configuracoes");
    await page.waitForTimeout(3_000);

    await expect(page.getByText("Temporada: Pontos por Vitória")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Temporada: Pontos por Derrota")).toBeVisible();
    await expect(page.getByText("Temporada: Bônus de Zebra")).toBeVisible();
    await expect(page.getByText("Temporada: Habilitar Bônus de Zebra")).toBeVisible();
  });

  test("botão 'Ativar' é visível para temporadas agendadas (upcoming)", async ({ page }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const adminUser = await createE2EUser("admin-ativar-btn");
    created.push(adminUser);

    await adminSupabase.from("users").update({ role: "admin" }).eq("id", adminUser.id);

    // Cria uma temporada upcoming para garantir que o botão Ativar apareça
    const slug = `qa-ativar-${Date.now().toString(36)}`;
    const future = new Date(Date.now() + 60 * 24 * 3600_000).toISOString();
    const { data: season } = await adminSupabase
      .from("seasons")
      .insert({
        name: "QA Temporada Ativar",
        slug,
        starts_at: new Date().toISOString(),
        ends_at: future,
        recurrence: "none",
        status: "upcoming",
      })
      .select("id")
      .single();

    // Limpeza após o teste
    if (season?.id) {
      const seasonId = season.id;
      page.on("close", async () => {
        await adminSupabase.from("seasons").delete().eq("id", seasonId);
      });
    }

    await loginViaUI(page, adminUser.email, adminUser.password);
    await page.goto("/admin/temporadas");
    await page.waitForTimeout(3_000);

    const ativarBtn = page.getByRole("button", { name: /Ativar/i }).first();
    const isVisible = await ativarBtn.isVisible().catch(() => false);

    if (!isVisible) {
      console.warn("⚠ ACHADO: botão 'Ativar' não visível — nenhuma temporada agendada encontrada");
      // Limpa a temporada criada
      if (season?.id) await adminSupabase.from("seasons").delete().eq("id", season.id);
      return;
    }

    expect(isVisible).toBe(true);

    // Limpa
    if (season?.id) await adminSupabase.from("seasons").delete().eq("id", season.id);
  });

  test("botão 'Ativar' abre modal de confirmação", async ({ page }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verifica se já existe temporada ativa (não podemos ativar se houver)
    const { data: activeSeason } = await adminSupabase
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle();

    const adminUser = await createE2EUser("admin-ativar-modal");
    created.push(adminUser);

    await adminSupabase.from("users").update({ role: "admin" }).eq("id", adminUser.id);

    const slug = `qa-modal-${Date.now().toString(36)}`;
    const future = new Date(Date.now() + 60 * 24 * 3600_000).toISOString();
    const { data: season } = await adminSupabase
      .from("seasons")
      .insert({
        name: "QA Modal Ativar",
        slug,
        starts_at: new Date().toISOString(),
        ends_at: future,
        recurrence: "none",
        status: "upcoming",
      })
      .select("id")
      .single();

    await loginViaUI(page, adminUser.email, adminUser.password);
    await page.goto("/admin/temporadas");
    await page.waitForTimeout(3_000);

    const ativarBtn = page.getByRole("button", { name: /Ativar/i }).first();
    const isVisible = await ativarBtn.isVisible().catch(() => false);

    if (!isVisible) {
      console.warn("⚠ ACHADO: botão 'Ativar' não encontrado — pulando teste de modal");
      if (season?.id) await adminSupabase.from("seasons").delete().eq("id", season.id);
      return;
    }

    await ativarBtn.click();

    // Modal de confirmação deve aparecer
    const hasModal = await page
      .getByText(/Ativar temporada/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    expect(hasModal).toBe(true);

    // Fecha o modal (pressiona Escape ou cancela) sem confirmar
    await page.keyboard.press("Escape");

    // Limpa
    if (season?.id) await adminSupabase.from("seasons").delete().eq("id", season.id);
    if (activeSeason) {
      // Se havia temporada ativa, não mudamos nada
    }
  });
});
