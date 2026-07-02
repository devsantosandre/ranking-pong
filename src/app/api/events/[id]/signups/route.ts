import { NextRequest, NextResponse } from "next/server";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import { isAdminServer } from "@/lib/admin";

// Inscrições contêm dados de contato (PII) → só admin lê.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminServer())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await params;
  const repo = await getTournamentRepo();
  const data = await repo.listEventSignups(id);
  return NextResponse.json(data);
}
