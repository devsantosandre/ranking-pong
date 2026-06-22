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
import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";

// Chip tingido a partir de um token de cor (themable / dark).
function tokenChipStyle(token: string) {
  return {
    background: `color-mix(in srgb, ${token} 14%, transparent)`,
    borderColor: `color-mix(in srgb, ${token} 30%, transparent)`,
    color: token,
  };
}

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
  token: string;
}> = [
  {
    role: "player",
    title: "Jogador",
    summary:
      "Usa as telas normais do app, registra partidas, confirma jogos e acompanha o ranking. Não entra na área administrativa.",
    icon: UserRound,
    token: "var(--state-tbd)",
  },
  {
    role: "moderator",
    title: "Moderador",
    summary:
      "Cuida da operação do dia a dia: acessa Admin, acompanha pendências, cancela partidas, cria jogador e reseta senha.",
    icon: ShieldCheck,
    token: "var(--state-active)",
  },
  {
    role: "admin",
    title: "Admin",
    summary:
      "Tem tudo do moderador e ainda altera regras, perfis, pontos, status da conta, visibilidade no ranking e configurações.",
    icon: Shield,
    token: "var(--arena-primary)",
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
    token: "var(--state-active)",
    description:
      "Vem do ajuste “Ocultar do ranking”. A conta continua ativa e pode entrar no app, mas sai do ranking, some das listas de adversários e não pode registrar partidas.",
  },
  {
    title: "Inativo",
    subtitle: "Não é perfil",
    icon: Lock,
    token: "var(--state-noshow)",
    description:
      "Vem do ajuste “Desativar”. No código atual, isso tira a conta das listagens e leituras que usam apenas jogadores ativos. Não existe um bloqueio separado de login no middleware.",
  },
];

function getAccessMeta(kind: AccessKind) {
  if (kind === "allowed") {
    return { icon: CheckCircle2, token: "var(--state-played)" };
  }
  if (kind === "limited") {
    return { icon: Minus, token: "var(--state-scheduled)" };
  }
  return { icon: Lock, token: "var(--state-tbd)" };
}

function AccessBadge({ cell }: { cell: AccessCell }) {
  const meta = getAccessMeta(cell.kind);
  const Icon = meta.icon;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={tokenChipStyle(meta.token)}
    >
      <Icon className="h-3.5 w-3.5" />
      {cell.label}
    </span>
  );
}

export default function AdminPerfisPage() {
  return (
    <ArenaShell
      title="Perfis e permissões"
      subtitle="Comparativo real entre Jogador, Moderador e Admin"
      showBack
      layoutWidth="wide"
    >
      <div className="flex flex-col gap-4">
        <GlassCard variant="strong" glow="primary">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)" }}>
              <UsersRound className="h-5 w-5 text-(--arena-primary)" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-(--arena-foreground)">
                Leitura baseada no comportamento atual do sistema
              </p>
              <p className="text-xs text-(--arena-muted)">
                Esta página resume o que cada perfil realmente consegue fazer hoje no app.
                O foco principal está na diferença entre Moderador e Admin.
              </p>
            </div>
          </div>
        </GlassCard>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roleCards.map((card) => {
            const Icon = card.icon;

            return (
              <GlassCard key={card.role}>
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                    style={tokenChipStyle(card.token)}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-sm font-semibold text-(--arena-foreground)">{card.title}</h2>
                    <p className="text-xs text-(--arena-muted)">{card.summary}</p>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </section>

        <GlassCard glow="active" style={{ background: "color-mix(in srgb, var(--state-active) 7%, var(--glass-bg))" }}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "color-mix(in srgb, var(--state-active) 16%, transparent)" }}>
              <ShieldCheck className="h-5 w-5" style={{ color: "var(--state-active)" }} />
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-(--arena-foreground)">
                  Diferença central entre Moderador e Admin
                </h2>
                <p className="text-xs text-(--arena-muted)">
                  O Moderador opera o dia a dia do ranking. O Admin, além disso, muda
                  estrutura, regras, visibilidade e perfis das contas.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-(--glass-border) bg-(--glass-bg-strong) p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--state-active)" }}>
                    Moderador pode
                  </p>
                  <ul className="mt-2 space-y-2 text-sm text-(--arena-foreground)">
                    <li>Criar jogador e resetar senha</li>
                    <li>Cancelar partidas e aceitar pendências</li>
                    <li>Consultar jogadores, métricas, logs e configurações em leitura</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-(--glass-border) bg-(--glass-bg-strong) p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--arena-primary)">
                    Só Admin pode
                  </p>
                  <ul className="mt-2 space-y-2 text-sm text-(--arena-foreground)">
                    <li>Alterar perfil, nome, pontos e estatísticas</li>
                    <li>Ativar, desativar e transformar conta em Observador</li>
                    <li>Salvar configurações do sistema</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="space-y-1">
              <h2 className="text-sm font-semibold text-(--arena-foreground)">
              Tabela comparativa de permissões
            </h2>
            <p className="text-xs text-(--arena-muted)">
              A tabela abaixo separa o que é permitido, bloqueado ou apenas parcial.
            </p>
          </div>

          <div className="mt-4 space-y-3 md:hidden">
            {permissionRows.map((row) => (
              <article
                key={row.capability}
                className="rounded-2xl border border-(--glass-border) bg-(--glass-bg) p-4"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-(--arena-foreground)">{row.capability}</h3>
                  <p className="text-xs leading-5 text-(--arena-muted)">{row.note}</p>
                </div>

                <div className="mt-4 space-y-2">
                  {roleAccessOrder.map((role) => (
                    <div
                      key={role.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-(--glass-border) bg-(--glass-bg-strong) px-3 py-2"
                    >
                      <span className="text-xs font-semibold text-(--arena-foreground)">
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
                  <th className="rounded-l-xl border border-(--glass-border) bg-(--glass-bg) px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--arena-muted)">
                    Funcionalidade
                  </th>
                  <th className="border-y border-(--glass-border) bg-(--glass-bg) px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--arena-muted)">
                    Jogador
                  </th>
                  <th className="border-y border-(--glass-border) bg-(--glass-bg) px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--arena-muted)">
                    Moderador
                  </th>
                  <th className="border-y border-(--glass-border) bg-(--glass-bg) px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--arena-muted)">
                    Admin
                  </th>
                  <th className="rounded-r-xl border border-(--glass-border) bg-(--glass-bg) px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-(--arena-muted)">
                    Observação
                  </th>
                </tr>
              </thead>
              <tbody>
                {permissionRows.map((row) => (
                  <tr key={row.capability}>
                    <td className="border-b border-(--glass-border) px-3 py-3 align-top text-xs font-medium text-(--arena-foreground) lg:text-sm">
                      {row.capability}
                    </td>
                    <td className="border-b border-(--glass-border) px-3 py-3 align-top">
                      <AccessBadge cell={row.player} />
                    </td>
                    <td className="border-b border-(--glass-border) px-3 py-3 align-top">
                      <AccessBadge cell={row.moderator} />
                    </td>
                    <td className="border-b border-(--glass-border) px-3 py-3 align-top">
                      <AccessBadge cell={row.admin} />
                    </td>
                    <td className="border-b border-(--glass-border) px-3 py-3 align-top text-[11px] leading-5 text-(--arena-muted) lg:text-xs">
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <section className="space-y-3">
          <div className="space-y-1">
              <h2 className="text-sm font-semibold text-(--arena-foreground)">
              Estados da conta que mudam a experiência
            </h2>
            <p className="text-xs text-(--arena-muted)">
              Observador e Inativo aparecem na tela de jogadores, mas não são tipos de perfil.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {stateCards.map((card) => {
              const Icon = card.icon;

              return (
                <GlassCard key={card.title}>
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                      style={tokenChipStyle(card.token)}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-(--arena-foreground)">{card.title}</h3>
                        <span className="rounded-full border border-(--glass-border) bg-(--glass-bg) px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-(--arena-muted)">
                          {card.subtitle}
                        </span>
                      </div>
                      <p className="text-xs text-(--arena-muted)">{card.description}</p>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </section>

        <Link
          href="/admin/jogadores"
          className="inline-flex w-full items-center justify-center rounded-xl border border-(--glass-border) bg-(--glass-bg-strong) px-4 py-3 text-sm font-semibold text-(--arena-foreground) transition hover:border-(--arena-primary) hover:text-(--arena-primary)"
        >
          Voltar para Jogadores
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </ArenaShell>
  );
}
