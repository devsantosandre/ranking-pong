import { AppShell } from "@/components/app-shell";

type MatchStatus = "pendente" | "validado" | "contestado";

type MatchCard = {
  me: string;
  opponent: string;
  score?: string;
  delta?: string;
  sets?: string;
  horario: string;
  status: MatchStatus;
};

const pendentes: MatchCard[] = [
  { me: "Você", opponent: "Ricardo Oliveira", horario: "Hoje 09:00", status: "pendente" },
  { me: "Você", opponent: "Felipe Velter", horario: "Ontem 20:10", status: "contestado" },
];

const recentes: MatchCard[] = [
  {
    me: "Lucas",
    opponent: "André",
    score: "3 x 2",
    delta: "+15 pts / -8 pts",
    sets: "Set 1: 2/3 · Set 2: 1/3",
    horario: "Hoje, 10:30",
    status: "validado",
  },
];

const statusBadge: Record<MatchStatus, { label: string; className: string }> = {
  pendente: { label: "Confirmação pendente", className: "bg-amber-100 text-amber-700" },
  contestado: { label: "Contestado", className: "bg-red-100 text-red-600" },
  validado: { label: "Validado", className: "bg-emerald-100 text-emerald-700" },
};

export default function PartidasPage() {
  return (
    <AppShell
      title="Partidas"
      subtitle="Recentes e Pendentes/Confirmação"
      showBack
    >
      <div className="space-y-4">
        <div className="flex gap-3 text-sm font-semibold">
          {["Recentes", "Pendentes/Confirmação"].map((tab, idx) => (
            <button
              key={tab}
              className={`rounded-full px-3 py-2 ${
                idx === 0
                  ? "bg-primary/15 text-primary"
                  : "bg-muted/70 text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {pendentes.map((item) => {
            const badge = statusBadge[item.status];
            return (
              <article
                key={`${item.opponent}-${item.horario}`}
                className="space-y-3 rounded-2xl border border-border bg-muted/60 p-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    vs {item.opponent} • {item.horario}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ao registrar, a partida fica pendente até o adversário confirmar. Se discordar, use
                  &quot;Contestar&quot;.
                </p>
                <div className="flex gap-2">
                  <button className="flex-1 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    Confirmar
                  </button>
                  <button className="flex-1 rounded-full border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    Contestar
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="space-y-3">
          {recentes.map((match) => {
            const badge = statusBadge[match.status];
            return (
              <article
                key={match.horario}
                className="space-y-2 rounded-2xl border border-border bg-card p-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{match.horario}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {match.me} <span className="text-primary">{match.score}</span>{" "}
                  {match.opponent}
                </p>
                <p className="text-xs font-semibold text-green-600">
                  {match.delta}
                </p>
                <p className="text-xs text-muted-foreground">{match.sets}</p>
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
