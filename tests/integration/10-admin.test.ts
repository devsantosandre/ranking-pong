import { describe, it, expect, afterAll } from "vitest";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  setUserRole,
  TestUser,
  userClient,
} from "../helpers/supabase";

const created: TestUser[] = [];

afterAll(async () => {
  for (const u of created) {
    await deleteTestUser(u.id);
  }
});

describe("Admin — promoção e acesso a settings/admin_logs", () => {
  it("admin consegue alterar o role de outro usuário (via service_role / RPC oficial)", async () => {
    const target = await createTestUser("admin-target");
    created.push(target);

    // service_role bypassa RLS — simula a server action de promoção
    await setUserRole(target.id, "moderator");

    const admin = adminClient();
    const { data } = await admin.from("users").select("role").eq("id", target.id).single();
    expect(data?.role).toBe("moderator");
  });

  it("settings.key/value existe e é legível por authenticated", async () => {
    const user = await createTestUser("settings-read");
    created.push(user);

    const supa = userClient(user.accessToken);
    const { data, error } = await supa.from("settings").select("key, value").limit(5);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("player comum não consegue inserir admin_logs", async () => {
    const user = await createTestUser("logs-noadmin");
    created.push(user);

    const supa = userClient(user.accessToken);
    const { error } = await supa.from("admin_logs").insert({
      actor_id: user.id,
      action: "FORBIDDEN",
      payload: { x: 1 },
    });
    expect(error).not.toBeNull();
  });

  it("admin (service_role) consegue inserir e ler admin_logs", async () => {
    const adminUser = await createTestUser("logs-admin");
    created.push(adminUser);
    await setUserRole(adminUser.id, "admin");

    const admin = adminClient();
    const { error: insertErr } = await admin.from("admin_logs").insert({
      admin_id: adminUser.id,
      admin_role: "admin",
      action: "TEST_QA",
      action_description: "Teste QA automatizado",
      target_type: "test",
    });
    expect(insertErr).toBeNull();

    const { data } = await admin
      .from("admin_logs")
      .select("id, action, admin_id")
      .eq("action", "TEST_QA")
      .order("created_at", { ascending: false })
      .limit(1);
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
