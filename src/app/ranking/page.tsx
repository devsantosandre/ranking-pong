import { AppShell } from "@/components/app-shell";
import { Search } from "lucide-react";

type Player = {
  name: string;
  points: number;
  variation: number;
  position: number;
  status?: "active" | "inactive";
};

const players: Player[] = [
  { name: "Lucas Silva", points: 1250, variation: +12, position: 1 },
  { name: "André Costa", points: 1180, variation: -5, position: 2 },
  { name: "Marcos P.", points: 1100, variation: 0, position: 3, status: "inactive" },
];

export default function RankingPage() {
  return (
    <AppShell
      title="Ranking"
      subtitle="Buscar, filtrar e desafiar jogadores"
      showBack
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/60 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Buscar jogador..."
          />
          <button className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            Desafiar
          </button>
        </div>

        <div className="flex gap-2 text-xs font-semibold">
          {["Todos", "Ativos", "Inativos"].map((filtro, idx) => (
            <button
              key={filtro}
              className={`rounded-full border px-3 py-2 ${
                idx === 0
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-foreground"
              }`}
            >
              {filtro}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {players.map((player) => (
            <article
              key={player.name}
              className="grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm"
            >
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {player.name}
                  </p>
                  {player.status === "inactive" ? (
                    <span className="text-[11px] font-semibold text-amber-500">
                      14d
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {player.points} pts
                </p>
                <p
                  className={`text-xs font-semibold ${
                    player.variation >= 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {player.variation >= 0 ? "+" : ""}
                  {player.variation}
                </p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-muted-foreground">
                  #{player.position}
                </span>
                <button className="mt-2 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  Desafiar
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
