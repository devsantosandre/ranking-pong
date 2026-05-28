import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sendPushToUsers } from "@/lib/push";
import { enforcePendingConfirmationSla } from "@/lib/matches/confirmation-sla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUSINESS_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RegisterMatchRpcRow = {
  match_id: string;
  opponent_id: string;
  actor_name: string | null;
  was_inserted: boolean;
};

type RegisterBody = {
  playerId?: string;
  opponentId?: string;
  outcome?: string;
  requestId?: string;
};

function parseScore(outcome: string | undefined): { a: number; b: number } | null {
  if (!outcome || typeof outcome !== "string") return null;

  const match = outcome.match(/^(\d{1,2})x(\d{1,2})$/);
  if (!match) return null;

  const a = Number.parseInt(match[1], 10);
  const b = Number.parseInt(match[2], 10);

  if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0 || a > 99 || b > 99 || a === b) {
    return null;
  }

  return { a, b };
}

function isUuid(value: string | undefined): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function parseRegisterMatchRpcRow(data: unknown): RegisterMatchRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;

  const candidate = row as Partial<RegisterMatchRpcRow>;
  if (
    typeof candidate.match_id !== "string" ||
    typeof candidate.opponent_id !== "string" ||
    typeof candidate.was_inserted !== "boolean"
  ) {
    return null;
  }

  return {
    match_id: candidate.match_id,
    opponent_id: candidate.opponent_id,
    actor_name: typeof candidate.actor_name === "string" ? candidate.actor_name : null,
    was_inserted: candidate.was_inserted,
  };
}

function mapRpcErrorMessage(message: string | undefined): { error: string; status: number } {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("not_authenticated")) {
    return { error: "Usuário não autenticado", status: 401 };
  }
  if (normalized.includes("actor_mismatch")) {
    return { error: "Sessão inválida para registrar a partida", status: 401 };
  }
  if (normalized.includes("same_player")) {
    return { error: "Você não pode jogar contra si mesmo", status: 400 };
  }
  if (normalized.includes("invalid_score")) {
    return { error: "Formato de placar inválido. Use o formato NxN (ex: 3x1)", status: 400 };
  }
  if (normalized.includes("daily_limit_reached")) {
    return { error: "Limite diário de jogos contra este adversário atingido", status: 409 };
  }
  if (normalized.includes("invalid_input")) {
    return { error: "Dados inválidos para registrar a partida", status: 400 };
  }
  if (normalized.includes("duplicate key value violates unique constraint")) {
    return {
      error: "Solicitação duplicada detectada. Atualize a tela e tente novamente.",
      status: 409,
    };
  }
  if (normalized.includes("invalid_k_factor")) {
    return { error: "Configuração de fator K inválida. Avise o administrador.", status: 500 };
  }

  return { error: "Erro ao registrar partida", status: 500 };
}

export async function POST(req: NextRequest) {
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido" }, { status: 400 });
  }

  const { playerId, opponentId, outcome, requestId } = body;

  const score = parseScore(outcome);
  if (!score) {
    return NextResponse.json(
      { error: "Formato de placar inválido. Use o formato NxN (ex: 3x1)" },
      { status: 400 }
    );
  }

  if (!playerId || !opponentId || playerId === opponentId) {
    return NextResponse.json(
      { error: "Você não pode jogar contra si mesmo" },
      { status: 400 }
    );
  }

  if (!isUuid(requestId)) {
    return NextResponse.json(
      { error: "Identificador de envio inválido. Tente novamente." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
  }

  if (user.id !== playerId) {
    return NextResponse.json(
      { error: "Sessão inválida para registrar a partida" },
      { status: 401 }
    );
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "register_match_with_notification_v1",
    {
      p_player_id: playerId,
      p_opponent_id: opponentId,
      p_resultado_a: score.a,
      p_resultado_b: score.b,
      p_request_id: requestId,
      p_timezone: BUSINESS_TIMEZONE,
    }
  );

  if (rpcError) {
    const mapped = mapRpcErrorMessage(rpcError.message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const row = parseRegisterMatchRpcRow(rpcData);
  if (!row) {
    return NextResponse.json({ error: "Erro ao registrar partida" }, { status: 500 });
  }

  if (row.was_inserted) {
    after(async () => {
      try {
        await sendPushToUsers([row.opponent_id], {
          title: "Nova partida para confirmar",
          body: `${row.actor_name || "Seu adversário"} registrou ${score.a}x${score.b}. Toque para revisar.`,
          url: "/partidas",
          tag: `pending-match-${row.match_id}`,
          data: {
            matchId: row.match_id,
            event: "pending_created",
          },
        });
      } catch (error) {
        console.error("register_match_push_failed", {
          matchId: row.match_id,
          opponentId: row.opponent_id,
          reason: error instanceof Error ? error.message : "unknown",
        });
      }

      try {
        await enforcePendingConfirmationSla({ responsibleUserId: playerId });
      } catch (error) {
        console.error("register_match_sla_enforcement_failed", {
          playerId,
          reason: error instanceof Error ? error.message : "unknown",
        });
      }
    });
  }

  return NextResponse.json({
    success: true,
    matchId: row.match_id,
    wasInserted: row.was_inserted,
  });
}
