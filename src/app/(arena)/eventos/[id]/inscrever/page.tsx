import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { EventSignupForm, type SignupDivisionOption } from "@/components/tournaments/event-signup-form";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InscreverEventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getTournamentRepo();
  const event = await repo.getEvent(id);
  if (!event) notFound();

  const mode = event.info?.payment?.mode ?? "manual";
  // Divisões disponíveis para inscrição (não rascunho).
  const divisions: SignupDivisionOption[] = event.divisions
    .filter((d) => d.status !== "draft")
    .map((d) => ({
      id: d.id,
      label: d.divisionLabel ?? d.name,
      levelDescription: d.levelDescription,
      startTime: d.startTime,
    }));

  return (
    <ArenaShell title="Inscrição" subtitle={event.name} showBack>
      {mode === "gateway" ? (
        <GlassCard className="py-10 text-center">
          <p className="text-sm text-(--arena-muted)">
            As inscrições online com pagamento automático estarão disponíveis em breve.
          </p>
        </GlassCard>
      ) : divisions.length === 0 ? (
        <GlassCard className="py-10 text-center">
          <p className="text-sm text-(--arena-muted)">Este evento ainda não tem divisões abertas para inscrição.</p>
        </GlassCard>
      ) : (
        <EventSignupForm
          eventId={event.id}
          divisions={divisions}
          paymentMode={mode}
          prices={event.info?.payment?.prices}
        />
      )}
    </ArenaShell>
  );
}
