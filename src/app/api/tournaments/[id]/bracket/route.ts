import { NextRequest, NextResponse } from "next/server";
import { getTournamentRepo } from "@/lib/tournaments/repo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const repo = await getTournamentRepo();
  const detail = await repo.getTournament(id);
  if (!detail) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ matches: detail.matches, participants: detail.participants });
}
