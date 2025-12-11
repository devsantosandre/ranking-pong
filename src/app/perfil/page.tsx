import { AppShell } from "@/components/app-shell";

const profile = {
  name: "André Santos",
  email: "andre.santos@clube.com",
  pontos: 312,
  streak: 5,
  jogosRecentes: [
    { adversario: "Felipe Velter Teles", resultado: "3x2", delta: "+20" },
    { adversario: "Saulo Velter Teles", resultado: "2x3", delta: "-8" },
  ],
};

export default function PerfilPage() {
  return (
    <AppShell
      title="Perfil"
      subtitle="Nome completo, contato e últimos jogos"
      showBack
    >
      <div className="grid gap-6 md:grid-cols-[1.1fr,0.9fr]">
        <section className="space-y-4 rounded-2xl border border-border bg-muted/40 p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
              AS
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {profile.name}
              </p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-border bg-card px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                Pontos
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {profile.pontos}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                Streak
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {profile.streak} vitórias
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <button className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-sm transition hover:scale-[1.01] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              Editar perfil
            </button>
            <button className="rounded-lg border border-border px-4 py-2 font-semibold text-foreground transition hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              QR / Convite
            </button>
            <button className="rounded-lg border border-border px-4 py-2 font-semibold text-foreground transition hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              Notificações
            </button>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            Últimos jogos
          </h2>
          <div className="space-y-2 text-sm">
            {profile.jogosRecentes.map((jogo, index) => (
              <div
                key={`${jogo.adversario}-${index}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    vs {jogo.adversario}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Resultado: {jogo.resultado}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    jogo.delta.startsWith("+")
                      ? "text-green-600"
                      : "text-red-500"
                  }`}
                >
                  {jogo.delta}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
