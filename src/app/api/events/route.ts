import { NextResponse } from "next/server";
import { getTournamentRepo } from "@/lib/tournaments/repo";

export async function GET() {
  const repo = await getTournamentRepo();
  const data = await repo.listEvents();
  return NextResponse.json(data);
}
