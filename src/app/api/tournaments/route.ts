import { NextRequest, NextResponse } from "next/server";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import type { Tournament } from "@/lib/tournaments/types";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") as Tournament["status"] | null;
  const repo = await getTournamentRepo();
  const data = await repo.listTournaments(status ? { status } : undefined);
  return NextResponse.json(data);
}
