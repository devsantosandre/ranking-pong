import { describe, it, expect, afterAll } from "vitest";
import {
  anonClient,
  createTestUser,
  deleteTestUser,
  TestUser,
} from "../helpers/supabase";

const created: TestUser[] = [];

afterAll(async () => {
  for (const u of created) {
    await deleteTestUser(u.id);
  }
});

describe("Autenticação — cadastro, login, logout, sessão", () => {
  it("admin cria usuário, trigger materializa linha em public.users", async () => {
    const user = await createTestUser("auth-create");
    created.push(user);

    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.email).toContain("@");
    expect(user.accessToken).toBeTypeOf("string");

    // trigger handle_new_user deve ter populado public.users
    const supa = anonClient();
    const { data } = await supa.auth.setSession({
      access_token: user.accessToken,
      refresh_token: "fake-refresh-not-used",
    });
    expect(data?.user?.id).toBe(user.id);
  });

  it("login com senha correta devolve sessão", async () => {
    const user = await createTestUser("auth-login");
    created.push(user);

    const supa = anonClient();
    const { data, error } = await supa.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });

    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTypeOf("string");
    expect(data.user?.id).toBe(user.id);
  });

  it("login com senha errada falha com mensagem clara", async () => {
    const user = await createTestUser("auth-login-fail");
    created.push(user);

    const supa = anonClient();
    const { data, error } = await supa.auth.signInWithPassword({
      email: user.email,
      password: "senha-totalmente-errada",
    });

    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });

  it("logout invalida a sessão", async () => {
    const user = await createTestUser("auth-logout");
    created.push(user);

    const supa = anonClient();
    await supa.auth.signInWithPassword({ email: user.email, password: user.password });
    const { error: signOutError } = await supa.auth.signOut();
    expect(signOutError).toBeNull();

    const { data } = await supa.auth.getSession();
    expect(data.session).toBeNull();
  });

  it("getUser com JWT válido retorna o mesmo usuário", async () => {
    const user = await createTestUser("auth-getuser");
    created.push(user);

    const supa = anonClient();
    const { data } = await supa.auth.getUser(user.accessToken);
    expect(data.user?.id).toBe(user.id);
  });
});
