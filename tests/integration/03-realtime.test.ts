import { describe, it, expect, afterAll } from "vitest";
import WebSocket from "ws";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  SUPABASE_URL,
  TestUser,
} from "../helpers/supabase";

const created: TestUser[] = [];

// supabase-js usa "ws" no Node mas precisa do polyfill quando rodando sem ws global
(globalThis as unknown as { WebSocket?: unknown }).WebSocket = WebSocket;

afterAll(async () => {
  for (const u of created) {
    await deleteTestUser(u.id);
  }
});

describe("Realtime — conexão e eventos", () => {
  it("realtime/websocket aceita conexão com anon key (HTTPS/WSS handshake)", async () => {
    const wsUrl =
      SUPABASE_URL.replace(/^https?:\/\//, "wss://") +
      "/realtime/v1/websocket?apikey=" +
      encodeURIComponent(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) +
      "&vsn=1.0.0";

    const result: { opened: boolean } = await new Promise((resolve) => {
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        ws.terminate();
        resolve({ opened: false });
      }, 6000);

      ws.on("open", () => {
        clearTimeout(timer);
        ws.close();
        resolve({ opened: true });
      });
      ws.on("error", () => {
        clearTimeout(timer);
        resolve({ opened: false });
      });
    });

    expect(result.opened).toBe(true);
  }, 15000);

  it("usuário recebe evento INSERT em notifications via Realtime (postgres_changes)", async () => {
    const user = await createTestUser("rt-notif");
    created.push(user);

    const supa = anonClient();
    await supa.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });

    // Evento compartilhado: resolve quando o payload chega, reject no timeout
    let resolveEvent!: (p: unknown) => void;
    let rejectEvent!: (e: Error) => void;
    const eventPromise = new Promise<unknown>((res, rej) => {
      resolveEvent = res;
      rejectEvent = rej;
    });

    // Registra o listener ANTES de chamar .subscribe()
    const channel = supa
      .channel(`rt-notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => resolveEvent(payload)
      );

    // Aguarda status SUBSCRIBED antes de inserir
    const subscribed = new Promise<boolean>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve(true);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve(false);
      });
    });

    const isSubscribed = await Promise.race([
      subscribed,
      new Promise<false>((r) => setTimeout(() => r(false), 10_000)),
    ]);
    expect(isSubscribed, "Canal não entrou em SUBSCRIBED — verifique configuração de Realtime no HML").toBe(true);

    // Inicia o timer de timeout após confirmação do canal
    const timeoutId = setTimeout(() => rejectEvent(new Error("Timeout aguardando evento Realtime")), 10_000);

    // Insere via service_role para disparar o evento Realtime
    const admin = adminClient();
    const { error: insertError } = await admin.from("notifications").insert({
      user_id: user.id,
      tipo: "ranking_update",
      payload: { source: "vitest-rt", ts: Date.now() },
      lida: false,
    });
    expect(insertError).toBeNull();

    const payload = await eventPromise.finally(() => clearTimeout(timeoutId));
    expect(payload).toBeTruthy();

    await supa.removeChannel(channel);
  }, 30_000);
});
