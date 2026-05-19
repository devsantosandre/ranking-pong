import { describe, it, expect, afterAll } from "vitest";
import { adminClient, createTestUser, deleteTestUser, TestUser, userClient } from "../helpers/supabase";

const created: TestUser[] = [];

afterAll(async () => {
  for (const u of created) {
    await deleteTestUser(u.id);
  }
});

describe("Conquistas — catálogo seedado e leitura", () => {
  it("catálogo achievements possui itens seedados", async () => {
    const admin = adminClient();
    const { data, error } = await admin
      .from("achievements")
      .select("id, key, name, description")
      .limit(50);

    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("usuário consegue ler suas próprias conquistas (user_achievements)", async () => {
    const user = await createTestUser("ach-read");
    created.push(user);

    const supa = userClient(user.accessToken);
    const { error, data } = await supa
      .from("user_achievements")
      .select("user_id, achievement_id")
      .eq("user_id", user.id);

    // Pode estar vazio para um usuário recém-criado, mas a query precisa ser bem sucedida
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("inserir manualmente uma conquista pelo service_role funciona", async () => {
    const user = await createTestUser("ach-insert");
    created.push(user);

    const admin = adminClient();
    const { data: catalog } = await admin
      .from("achievements")
      .select("id, key")
      .limit(1);
    if (!catalog || catalog.length === 0) return; // ambiente sem catálogo

    const achievementId = catalog[0].id;

    const { error } = await admin
      .from("user_achievements")
      .insert({ user_id: user.id, achievement_id: achievementId });
    expect(error).toBeNull();

    const supa = userClient(user.accessToken);
    const { data: mine } = await supa
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", user.id);
    expect((mine ?? []).some((r) => r.achievement_id === achievementId)).toBe(true);
  });
});
