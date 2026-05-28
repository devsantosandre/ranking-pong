import {
  getAllPendingMatches,
  removePendingMatch,
  type PendingMatchPayload,
} from "./match-sync-queue";

export type RegisterMatchResponse =
  | { success: true; matchId: string; wasInserted: boolean }
  | { success: false; error: string; status: number };

export const FOREGROUND_REQUEST_TIMEOUT_MS = 3000;

export async function postRegisterMatch(
  payload: Pick<PendingMatchPayload, "playerId" | "opponentId" | "outcome" | "requestId">,
  options?: { timeoutMs?: number }
): Promise<RegisterMatchResponse> {
  const timeoutMs = options?.timeoutMs ?? FOREGROUND_REQUEST_TIMEOUT_MS;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const res = await fetch("/api/matches/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
      signal: controller?.signal,
    });

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      matchId?: string;
      wasInserted?: boolean;
      error?: string;
    };

    if (!res.ok) {
      return {
        success: false,
        error: data.error || "Erro ao registrar partida",
        status: res.status,
      };
    }

    return {
      success: true,
      matchId: data.matchId || "",
      wasInserted: data.wasInserted ?? true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro de rede",
      status: 0,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function flushPendingMatchQueue(): Promise<{
  attempted: number;
  succeeded: number;
  dropped: number;
}> {
  const pending = await getAllPendingMatches();
  let succeeded = 0;
  let dropped = 0;

  for (const payload of pending) {
    const result = await postRegisterMatch(
      {
        playerId: payload.playerId,
        opponentId: payload.opponentId,
        outcome: payload.outcome,
        requestId: payload.requestId,
      },
      { timeoutMs: 10_000 }
    );

    if (result.success) {
      await removePendingMatch(payload.requestId);
      succeeded += 1;
      continue;
    }

    if (result.status >= 400 && result.status < 500) {
      await removePendingMatch(payload.requestId);
      dropped += 1;
      continue;
    }
  }

  return { attempted: pending.length, succeeded, dropped };
}

