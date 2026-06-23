import { NextRequest, NextResponse } from "next/server";
import { getTournamentRepo } from "@/lib/tournaments/repo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const repo = await getTournamentRepo();
  const data = await repo.getTournament(id);
  if (!data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(data);
}
