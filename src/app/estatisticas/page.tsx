import { AppShell } from "@/components/app-shell";

const snapshot = {
  pontosAtuais: 312,
  variacaoSemanal: "+18",
  streak: 5,
  jogosMes: 12,
  vitorias: 8,
  derrotas: 4,
  inatividadeAviso: "Em 3 dias aplica -5 pts se não jogar.",
};

const history = [
  { label: "Seg", value: 276 },
  { label: "Ter", value: 284 },
  { label: "Qua", value: 290 },
  { label: "Qui", value: 294 },
  { label: "Sex", value: 300 },
  { label: "Sáb", value: 306 },
  { label: "Dom", value: 312 },
];

export default function EstatisticasPage() {
  return (
    <AppShell
      title="Estatísticas"
      subtitle="Snapshot de pontos, streak e histórico resumido"
      showBack
    >
      <div className="grid gap-6">
        <div className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4 shadow-sm md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
              Pontos atuais
            </p>
            <p className="text-3xl font-semibold text-foreground">
              {snapshot.pontosAtuais}
            </p>
            <p className="text-sm text-green-600">
              {snapshot.variacaoSemanal} na semana
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
              Streak
            </p>
            <p className="text-3xl font-semibold text-foreground">
              {snapshot.streak} vitórias
            </p>
            <p className="text-sm text-muted-foreground">
              Jogos no mês: {snapshot.jogosMes}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
              Parciais
            </p>
            <p className="text-3xl font-semibold text-foreground">
              {snapshot.vitorias} / {snapshot.derrotas}
            </p>
            <p className="text-sm text-amber-500">{snapshot.inatividadeAviso}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/40 p-4 shadow-sm">
          <p className="text-sm font-semibold text-foreground">
            Histórico (últimos 7 dias)
          </p>
          <div className="mt-4 grid grid-cols-7 items-end gap-2">
            {history.map((point) => (
              <div key={point.label} className="flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-md bg-primary/80"
                  style={{ height: `${(point.value / 320) * 140}px` }}
                />
                <span className="text-xs text-muted-foreground">
                  {point.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Barra proporcional aos pontos; 320 seria o topo da escala deste
            recorte.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
