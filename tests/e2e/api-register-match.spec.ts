import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  createE2EUser,
  deleteE2EUser,
  loginByCookieReady,
  type E2EUser,
} from "./helpers/auth";

const created: E2EUser[] = [];

test.afterAll(async () => {
  for (const u of created) {
    await deleteE2EUser(u.id);
  }
});

test.describe("API /api/matches/register — validações HTTP", () => {
  test("rejeita JSON malformado com 400", async ({ request }) => {
    const res = await request.post("/api/matches/register", {
      data: "not-json" as unknown as object,
      headers: { "Content-Type": "application/json" },
    });
    expect([400, 401]).toContain(res.status());
  });

  test("rejeita sem auth com 401", async ({ request }) => {
    const res = await request.post("/api/matches/register", {
      data: {
        playerId: randomUUID(),
        opponentId: randomUUID(),
        outcome: "3x1",
        requestId: randomUUID(),
      },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/autenticado/i);
  });

  test("rejeita placar inválido (empate) com 400", async ({ request }) => {
    const res = await request.post("/api/matches/register", {
      data: {
        playerId: randomUUID(),
        opponentId: randomUUID(),
        outcome: "3x3",
        requestId: randomUUID(),
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/placar|score/i);
  });

  test("rejeita formato de outcome inválido (NaN) com 400", async ({ request }) => {
    const res = await request.post("/api/matches/register", {
      data: {
        playerId: randomUUID(),
        opponentId: randomUUID(),
        outcome: "abc",
        requestId: randomUUID(),
      },
    });
    expect(res.status()).toBe(400);
  });

  test("rejeita mesmo jogador (playerId == opponentId) com 400", async ({ request }) => {
    const sameId = randomUUID();
    const res = await request.post("/api/matches/register", {
      data: {
        playerId: sameId,
        opponentId: sameId,
        outcome: "3x1",
        requestId: randomUUID(),
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/si mesmo|mesmo jogador|same/i);
  });

  test("rejeita requestId não-UUID com 400", async ({ request }) => {
    const res = await request.post("/api/matches/register", {
      data: {
        playerId: randomUUID(),
        opponentId: randomUUID(),
        outcome: "3x1",
        requestId: "not-a-uuid",
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/identificador|envio|invalid/i);
  });

  test("registro autenticado funciona e é idempotente (mesmo requestId)", async ({
    page,
    request,
  }) => {
    const playerA = await createE2EUser("api-idem-a");
    const playerB = await createE2EUser("api-idem-b");
    created.push(playerA, playerB);

    // Faz login via UI (helper robusto) para obter cookies de sessão Supabase
    await loginByCookieReady(page, playerA.email, playerA.password);

    // Reusa o storage state da sessão autenticada
    const storage = await page.context().storageState();
    const cookies = storage.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const requestId = randomUUID();
    const payload = {
      playerId: playerA.id,
      opponentId: playerB.id,
      outcome: "3x1",
      requestId,
    };

    const first = await request.post("/api/matches/register", {
      data: payload,
      headers: { Cookie: cookies },
    });
    expect(first.ok(), `primeiro request: ${first.status()}`).toBe(true);
    const firstBody = await first.json();
    expect(firstBody.success).toBe(true);
    expect(firstBody.wasInserted).toBe(true);

    const second = await request.post("/api/matches/register", {
      data: payload,
      headers: { Cookie: cookies },
    });
    expect(second.ok()).toBe(true);
    const secondBody = await second.json();
    expect(secondBody.matchId).toBe(firstBody.matchId);
    expect(secondBody.wasInserted).toBe(false);
  });
});
