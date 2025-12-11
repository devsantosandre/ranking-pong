import { AppShell } from "@/components/app-shell";

const highlights = {
  pontos: 312,
  variacao: "+18",
  proximo: "Hoje 19h • Quadra 02 • vs Ítalo Vinícius",
};

const topRanking = [
  { pos: 1, nome: "André Santos", pts: 312, delta: "+18" },
  { pos: 2, nome: "Ítalo Vinícius Pereira Costa", pts: 298, delta: "+6" },
  { pos: 3, nome: "Felipe Velter Teles", pts: 284, delta: "-4" },
];

const feedRecentes = [
  {
    titulo: "Resultado",
    texto: "Felipe Velter Teles ganhou de Saulo Velter Teles por 6x3 4x6 10x6.",
  },
  {
    titulo: "Resultado",
    texto:
      "André Luís de Sousa Santos ganhou de Carlos Alberto Gonçalves por 7x5 7x6.",
  },
];

const partidasPendentes = [
  "Aguardando confirmação: Ítalo vs Everton (máx. 2 jogos/dia).",
  "Aguardando confirmação: Saulo vs Felipe.",
];

export default function Home() {
  return (
    <AppShell
      title="Visão geral"
      subtitle="Atalhos rápidos para Ranking, Partidas, Notícias e Estatísticas"
      showBack={false}
    >
      <div className="flex flex-col gap-6">
        <section className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                Seus pontos
              </p>
              <p className="text-3xl font-semibold text-foreground">
                {highlights.pontos}
              </p>
              <p className="text-sm text-green-500">
                {highlights.variacao} na semana
              </p>
            </div>
            <div className="rounded-2xl bg-primary/15 px-3 py-2 text-xs font-semibold text-primary">
              Próximo jogo
              <div className="text-[11px] text-foreground/80">
                {highlights.proximo}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {topRanking.map((player) => (
              <div
                key={player.pos}
                className="rounded-xl border border-border bg-card px-3 py-3"
              >
                <p className="text-xs font-semibold text-primary">
                  {player.pos}º lugar
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {player.nome}
                </p>
                <p className="text-xs text-muted-foreground">
                  {player.pts} pts •{" "}
                  <span
                    className={
                      player.delta.startsWith("+")
                        ? "text-green-600"
                        : "text-red-500"
                    }
                  >
                    {player.delta}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              Partidas pendentes
            </p>
            <a
              className="text-sm font-semibold text-primary hover:underline"
              href="/partidas"
            >
              Ver todas
            </a>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            {partidasPendentes.map((p) => (
              <div
                key={p}
                className="rounded-xl border border-border bg-card px-3 py-2"
              >
                {p}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Notícias</p>
            <a
              className="text-sm font-semibold text-primary hover:underline"
              href="/noticias"
            >
              Ver feed
            </a>
          </div>
          <div className="space-y-3">
            {feedRecentes.map((item, idx) => (
              <article
                key={idx}
                className="space-y-1 rounded-xl border border-border bg-card px-3 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                  {item.titulo}
                </p>
                <p className="text-sm leading-6 text-foreground">{item.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Estatísticas</p>
            <a
              className="text-sm font-semibold text-primary hover:underline"
              href="/estatisticas"
            >
              Ver detalhes
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-border bg-card px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                Streak
              </p>
              <p className="text-2xl font-semibold text-foreground">5 vitórias</p>
              <p className="text-xs text-muted-foreground">Jogos no mês: 12</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                Alertas
              </p>
              <p className="text-sm font-semibold text-amber-500">
                Inatividade em 3 dias (-5 pts)
              </p>
              <p className="text-xs text-muted-foreground">
                Evite queda jogando 1 partida.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
