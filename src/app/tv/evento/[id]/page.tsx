import { getTournamentRepo } from "@/lib/tournaments/repo";
import { notFound } from "next/navigation";
import { TvEventView } from "@/components/tv/tv-event-view";

export const dynamic = "force-dynamic";

export default async function TvEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const rotateRaw = Array.isArray(sp.rotate) ? sp.rotate[0] : sp.rotate;
  // Auto-rotação opcional: ?rotate=N segundos (5–120, padrão da indústria = 15s).
  const parsed = rotateRaw ? parseInt(rotateRaw, 10) : 0;
  const rotateSeconds = parsed ? Math.min(120, Math.max(5, parsed)) : 0;

  const repo = await getTournamentRepo();
  const event = await repo.getEvent(id);
  if (!event) notFound();

  return <TvEventView eventId={id} initialEvent={event} rotateSeconds={rotateSeconds} />;
}
