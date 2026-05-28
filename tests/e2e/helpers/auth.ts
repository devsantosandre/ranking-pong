import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { deleteSingleTestUser } from "../../helpers/cleanup";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const PASSWORD = process.env.TEST_USER_PASSWORD || "Qa!Rank1ng#2026";

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export type E2EUser = {
  id: string;
  email: string;
  password: string;
  name: string;
  accessToken: string;
};

export async function createE2EUser(label: string): Promise<E2EUser> {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  const email = `qa-e2e-${label}-${ts}-${rand}@example.com`;
  const name = `QA E2E ${label}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data?.user) throw new Error(`createE2EUser: ${error?.message}`);

  // garante linha em public.users
  await admin.from("users").upsert(
    {
      id: data.user.id,
      email,
      name,
      full_name: name,
      role: "player",
      rating_atual: 250,
    },
    { onConflict: "id" }
  );

  // Obtém access_token para chamadas de RPC que exigem sessão autenticada
  const anonClient = createClient(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session } = await anonClient.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  const accessToken = session?.session?.access_token ?? "";

  return { id: data.user.id, email, password: PASSWORD, name, accessToken };
}

export async function deleteE2EUser(userId: string): Promise<void> {
  await deleteSingleTestUser(userId, admin);
}

export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 }),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
}

/**
 * Login robusto para ambientes onde o redirect pós-login não dispara
 * de forma confiável (ex.: localhost com SameSite/Secure cookies).
 *
 * Estratégia:
 * 1. Submete o formulário.
 * 2. Espera que o @supabase/ssr escreva o cookie sb-...-auth-token.
 * 3. Navega manualmente para a página alvo, deixando o middleware revalidar.
 */
export async function loginByCookieReady(
  page: Page,
  email: string,
  password: string,
  postLoginPath = "/"
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Aguarda o cookie de auth do Supabase aparecer (independente do redirect).
  await page.waitForFunction(
    () => /sb-[^=]+-auth-token/.test(document.cookie),
    null,
    { timeout: 20_000 }
  );

  // Navega manualmente; middleware vai validar o cookie e liberar.
  await page.goto(postLoginPath);
  await page.waitForURL(
    (url) => !url.pathname.startsWith("/login"),
    { timeout: 20_000 }
  );
}
