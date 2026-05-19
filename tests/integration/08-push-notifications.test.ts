import { describe, it, expect, afterAll } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  TestUser,
  userClient,
} from "../helpers/supabase";

const created: TestUser[] = [];

afterAll(async () => {
  for (const u of created) {
    await deleteTestUser(u.id);
  }
});

describe("Push Notifications — subscription e VAPID", () => {
  it("chaves VAPID estão configuradas no ambiente", () => {
    expect(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY).toBeTypeOf("string");
    expect(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.length).toBeGreaterThan(50);
    expect(process.env.VAPID_PRIVATE_KEY).toBeTypeOf("string");
    expect(process.env.VAPID_SUBJECT).toMatch(/^mailto:/);
  });

  it("anon NÃO consegue inserir uma push_subscription para outro usuário", async () => {
    const supa = anonClient();
    const { error } = await supa.from("push_subscriptions").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      endpoint: "https://fake.push.example/dummy",
      p256dh: "AAAA",
      auth: "BBBB",
    });
    expect(error).not.toBeNull();
  });

  it("service_role consegue upsert e desativar uma subscription (fluxo do API route)", async () => {
    const user = await createTestUser("push-sub");
    created.push(user);

    const admin = adminClient();
    const endpoint = `https://fake.push.example/${user.id}-${Date.now()}`;
    const now = new Date().toISOString();

    const { error: upErr } = await admin.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh: "p256dh-dummy",
        auth: "auth-dummy",
        platform: "test",
        disabled_at: null,
        last_error: null,
        updated_at: now,
      },
      { onConflict: "endpoint" }
    );
    expect(upErr).toBeNull();

    const { data: row } = await admin
      .from("push_subscriptions")
      .select("id, user_id, disabled_at, endpoint")
      .eq("endpoint", endpoint)
      .single();
    expect(row?.user_id).toBe(user.id);
    expect(row?.disabled_at).toBeNull();

    // soft-delete: marca como desabilitado
    const { error: delErr } = await admin
      .from("push_subscriptions")
      .update({ disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("endpoint", endpoint);
    expect(delErr).toBeNull();

    const { data: after } = await admin
      .from("push_subscriptions")
      .select("disabled_at")
      .eq("endpoint", endpoint)
      .single();
    expect(after?.disabled_at).not.toBeNull();
  });

  it("usuário autenticado vê apenas as suas push_subscriptions", async () => {
    const userA = await createTestUser("psub-a");
    const userB = await createTestUser("psub-b");
    created.push(userA, userB);

    const admin = adminClient();
    const eA = `https://fake.push/${userA.id}-${Date.now()}`;
    const eB = `https://fake.push/${userB.id}-${Date.now()}`;
    await admin.from("push_subscriptions").upsert([
      { user_id: userA.id, endpoint: eA, p256dh: "a", auth: "a", updated_at: new Date().toISOString() },
      { user_id: userB.id, endpoint: eB, p256dh: "b", auth: "b", updated_at: new Date().toISOString() },
    ], { onConflict: "endpoint" });

    const supaA = userClient(userA.accessToken);
    const { data, error } = await supaA
      .from("push_subscriptions")
      .select("user_id, endpoint");

    expect(error).toBeNull();
    for (const r of data ?? []) {
      expect(r.user_id).toBe(userA.id);
    }
  });
});
