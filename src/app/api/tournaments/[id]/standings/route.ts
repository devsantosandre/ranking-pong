import { NextRequest, NextResponse } from "next/server";
import { getTournamentRepo } from "@/lib/tournaments/repo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const repo = await getTournamentRepo();
  const data = await repo.getStandings(id);
  return NextResponse.json(data);
}
