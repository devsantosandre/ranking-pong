import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  EyeOff,
  Lock,
  Minus,
  Shield,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";

type RoleKey = "player" | "moderator" | "admin";
type AccessKind = "allowed" | "limited" | "blocked";

type AccessCell = {
  kind: AccessKind;
  label: string;
};

type PermissionRow = {
  capability: string;
  note: string;
  player: AccessCell;
  moderator: AccessCell;
  admin: AccessCell;
};

const roleAccessOrder: Array<{ key: RoleKey; label: string }> = [
  { key: "player", label: "Jogador" },
  { key: "moderator", label: "Moderador" },
  { key: "admin", label: "Admin" },
];

const roleCards: Array<{
  role: RoleKey;
  title: string;
  summary: string;
  icon: typeof UserRound;
  tone: string;
}> = [
  {
    role: "player",
    title: "Jogador",
    summary:
      "Usa as telas normais do app, registra partidas, confirma jogos e acompanha o ranking. Não entra na área administrativa.",
    icon: UserRound,
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    role: "moderator",
    title: "Moderador",
    summary:
      "Cuida da operação do dia a dia: acessa Admin, acompanha pendências, cancela partidas, cria jogador e reseta senha.",
    icon: ShieldCheck,
    tone: "border-sky-200 bg-sky-50 text-sky-700",
  },
  {
    role: "admin",
    title: "Admin",
    summary:
      "Tem tudo do moderador e ainda altera regras, perfis, pontos, status da conta, visibilidade no ranking e configurações.",
    icon: Shield,
    tone: "border-violet-200 bg-violet-50 text-violet-700",
  },
];

const permissionRows: PermissionRow[] = [
  {
    capability: "Usar as telas normais do app",
    note: "Ranking, partidas, notícias e perfil continuam disponíveis para os três perfis.",
    player: { kind: "allowed", label: "Sim" },
    moderator: { kind: "allowed", label: "Sim" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Acessar a área Admin",
    note: "A entrada no menu e no layout administrativo depende do perfil.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "allowed", label: "Sim" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Ver e buscar jogadores",
    note: "Inclui listagem, filtros por status/perfil e busca por nome ou email.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "allowed", label: "Sim" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Criar novo jogador",
    note: "Todo novo cadastro nasce como Jogador.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "allowed", label: "Sim" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Resetar senha de jogador",
    note: "Permite definir uma nova senha temporária para outra conta.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "allowed", label: "Sim" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Ver e gerenciar partidas",
    note: "Inclui abrir /admin/partidas e cancelar partidas manualmente.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "allowed", label: "Sim" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Resolver pendências manualmente",
    note: "Inclui aceitar pendências e cancelar casos antes da confirmação automática.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "allowed", label: "Sim" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Ver métricas e histórico",
    note: "Os dois perfis administrativos conseguem abrir métricas e logs.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "allowed", label: "Sim" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Ver configurações do sistema",
    note: "Hoje, o card de Configurações fica escondido para moderador no painel, mas a leitura funciona se ele entrar pela URL direta.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "limited", label: "Leitura" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Salvar configurações do sistema",
    note: "Exemplos: fator K, limite diário e prazo de confirmação automática.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "blocked", label: "Não" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Editar nome de outro jogador",
    note: "A tela bloqueia a edição do próprio nome por esse caminho.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "blocked", label: "Não" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Editar pontos (rating)",
    note: "Altera o rating manualmente e registra a mudança no histórico administrativo.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "blocked", label: "Não" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Ativar ou desativar conta",
    note: "Muda o estado ativo da conta. Isso é separado do perfil.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "blocked", label: "Não" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Ocultar ou mostrar no ranking",
    note: "Esse ajuste cria o estado Observador. Também é separado do perfil.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "blocked", label: "Não" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Resetar estatísticas",
    note: "Zera vitórias, derrotas, jogos e volta o rating para o valor inicial configurado.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "blocked", label: "Não" },
    admin: { kind: "allowed", label: "Sim" },
  },
  {
    capability: "Alterar perfil de outra conta",
    note: "Só o admin pode promover ou rebaixar entre Jogador, Moderador e Admin. O próprio admin não pode mudar o próprio perfil por essa tela.",
    player: { kind: "blocked", label: "Não" },
    moderator: { kind: "blocked", label: "Não" },
    admin: { kind: "allowed", label: "Sim" },
  },
];

const stateCards = [
  {
    title: "Observador",
    subtitle: "Não é perfil",
    icon: EyeOff,
    tone: "border-indigo-200 bg-indigo-50 text-indigo-700",
    description:
      "Vem do ajuste “Ocultar do ranking”. A conta continua ativa e pode entrar no app, mas sai do ranking, some das listas de adversários e não pode registrar partidas.",
  },
  {
    title: "Inativo",
    subtitle: "Não é perfil",
    icon: Lock,
    tone: "border-rose-200 bg-rose-50 text-rose-700",
    description:
      "Vem do ajuste “Desativar”. No código atual, isso tira a conta das listagens e leituras que usam apenas jogadores ativos. Não existe um bloqueio separado de login no middleware.",
  },
];

function getAccessMeta(kind: AccessKind) {
  if (kind === "allowed") {
    return {
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (kind === "limited") {
    return {
      icon: Minus,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    icon: Lock,
    className: "border-slate-200 bg-slate-100 text-slate-600",
  };
}

function AccessBadge({ cell }: { cell: AccessCell }) {
  const meta = getAccessMeta(cell.kind);
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {cell.label}
    </span>
  );
}

export default function AdminPerfisPage() {
  return (
    <AppShell
      title="Perfis e permissões"
      subtitle="Comparativo real entre Jogador, Moderador e Admin"
      showBack
      layoutWidth="wide"
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <UsersRound className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Leitura baseada no comportamento atual do sistema
              </p>
              <p className="text-xs text-muted-foreground">
                Esta página resume o que cada perfil realmente consegue fazer hoje no app.
                O foco principal está na diferença entre Moderador e Admin.
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roleCards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.role}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${card.tone}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-sm font-semibold text-foreground">{card.title}</h2>
                    <p className="text-xs text-muted-foreground">{card.summary}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70">
              <ShieldCheck className="h-5 w-5 text-sky-700" />
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-sky-950">
                  Diferença central entre Moderador e Admin
                </h2>
                <p className="text-xs text-sky-900/80">
                  O Moderador opera o dia a dia do ranking. O Admin, além disso, muda
                  estrutura, regras, visibilidade e perfis das contas.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-sky-200 bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
                    Moderador pode
                  </p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    <li>Criar jogador e resetar senha</li>
                    <li>Cancelar partidas e aceitar pendências</li>
                    <li>Consultar jogadores, métricas, logs e configurações em leitura</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-violet-200 bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">
                    Só Admin pode
                  </p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    <li>Alterar perfil, nome, pontos e estatísticas</li>
                    <li>Ativar, desativar e transformar conta em Observador</li>
                    <li>Salvar configurações do sistema</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">
              Tabela comparativa de permissões
            </h2>
            <p className="text-xs text-muted-foreground">
              A tabela abaixo separa o que é permitido, bloqueado ou apenas parcial.
            </p>
          </div>

          <div className="mt-4 space-y-3 md:hidden">
            {permissionRows.map((row) => (
              <article
                key={row.capability}
                className="rounded-2xl border border-border bg-muted/10 p-4"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">{row.capability}</h3>
                  <p className="text-xs leading-5 text-muted-foreground">{row.note}</p>
                </div>

                <div className="mt-4 space-y-2">
                  {roleAccessOrder.map((role) => (
                    <div
                      key={role.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2"
                    >
                      <span className="text-xs font-semibold text-foreground">
                        {role.label}
                      </span>
                      <AccessBadge cell={row[role.key]} />
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th className="rounded-l-xl border border-border bg-muted/40 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Funcionalidade
                  </th>
                  <th className="border-y border-border bg-muted/40 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Jogador
                  </th>
                  <th className="border-y border-border bg-muted/40 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Moderador
                  </th>
                  <th className="border-y border-border bg-muted/40 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Admin
                  </th>
                  <th className="rounded-r-xl border border-border bg-muted/40 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Observação
                  </th>
                </tr>
              </thead>
              <tbody>
                {permissionRows.map((row) => (
                  <tr key={row.capability}>
                    <td className="border-b border-border px-3 py-3 align-top text-xs font-medium text-foreground lg:text-sm">
                      {row.capability}
                    </td>
                    <td className="border-b border-border px-3 py-3 align-top">
                      <AccessBadge cell={row.player} />
                    </td>
                    <td className="border-b border-border px-3 py-3 align-top">
                      <AccessBadge cell={row.moderator} />
                    </td>
                    <td className="border-b border-border px-3 py-3 align-top">
                      <AccessBadge cell={row.admin} />
                    </td>
                    <td className="border-b border-border px-3 py-3 align-top text-[11px] leading-5 text-muted-foreground lg:text-xs">
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">
              Estados da conta que mudam a experiência
            </h2>
            <p className="text-xs text-muted-foreground">
              Observador e Inativo aparecem na tela de jogadores, mas não são tipos de perfil.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {stateCards.map((card) => {
              const Icon = card.icon;

              return (
                <article
                  key={card.title}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${card.tone}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {card.subtitle}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{card.description}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <Link
          href="/admin/jogadores"
          className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
        >
          Voltar para Jogadores
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </AppShell>
  );
}
