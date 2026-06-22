import Link from "next/link";
import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <GlassCard>
      <h2 className="text-sm font-semibold text-(--arena-foreground)" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
      <div className="mt-2 space-y-2 text-sm text-(--arena-muted)">{children}</div>
    </GlassCard>
  );
}

export default function CorrecaoSemRecalculoPage() {
  return (
    <ArenaShell
      title="Correção sem recálculo"
      subtitle="Quando usar e o que ela pode afetar"
      showBack
    >
      <div className="space-y-4">
        <GlassCard
          glow="scheduled"
          style={{ background: "color-mix(in srgb, var(--state-scheduled) 10%, var(--glass-bg))" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--state-scheduled)" }}>
            Esta opção é excepcional
          </p>
          <p className="mt-2 text-sm text-(--arena-foreground)">
            Ela existe para casos em que uma partida errada já ficou antiga, o
            cancelamento seguro não é mais possível e o ranking já foi
            prejudicado.
          </p>
        </GlassCard>

        <InfoCard title="Quando faz sentido usar">
          <p>
            Quando o placar foi confirmado errado, novas partidas já aconteceram
            depois e a pessoa afetada ficou sem uma saída prática.
          </p>
          <p>
            Um exemplo é quando o sistema confirmou automaticamente uma partida
            que deveria ter sido contestada antes do prazo.
          </p>
        </InfoCard>

        <InfoCard title="O que a correção faz">
          <p>Compensa os pontos apenas entre os dois jogadores da partida.</p>
          <p>Retira essa partida do ranking como resultado válido.</p>
          <p>Atualiza vitórias, derrotas, jogos e streak dos dois jogadores.</p>
          <p>Remove conquistas vinculadas diretamente a essa partida.</p>
        </InfoCard>

        <InfoCard title="O que ela não faz">
          <p>Não recalcula partidas posteriores.</p>
          <p>Não reprocessa automaticamente a cadeia inteira do ranking.</p>
          <p>
            Não corrige efeitos indiretos que já podem ter se espalhado para
            outros jogadores depois dessa partida.
          </p>
        </InfoCard>

        <InfoCard title="Por que isso pode afetar o ranking">
          <p>
            Quando uma partida validada altera o rating, os jogos seguintes são
            calculados sobre esse novo estado.
          </p>
          <p>
            Se o placar estava errado e o sistema confirmou automaticamente,
            quem foi prejudicado pode cair no ranking, perder destaque e até ter
            a sequência de vitórias afetada.
          </p>
          <p>
            Por isso a correção sem recálculo deve ser usada com consciência: ela
            reduz o dano para os dois jogadores da partida, mas não apaga todo o
            efeito histórico.
          </p>
        </InfoCard>

        <InfoCard title="Antes de aplicar">
          <p>Confirme se o cancelamento normal realmente não é mais possível.</p>
          <p>Verifique se o erro do placar está claro e bem documentado.</p>
          <p>
            Registre no motivo por que o admin está assumindo essa correção
            excepcional.
          </p>
          <p>
            Se o caso for muito sensível, considere segurar a correção e avaliar
            um recálculo histórico completo.
          </p>
        </InfoCard>

        <GlassCard variant="strong" className="text-sm text-(--arena-muted)">
          <p className="font-semibold text-(--arena-foreground)" style={{ fontFamily: "var(--font-display)" }}>
            Resumo
          </p>
          <p className="mt-2">
            A correção sem recálculo é uma saída de contenção. Ela é útil para
            resolver um prejuízo claro no ranking sem parar a operação do app,
            mas não substitui um recálculo histórico completo.
          </p>
          <Link
            href="/admin/partidas"
            className="mt-3 inline-flex items-center gap-1.5 font-semibold text-(--arena-primary) underline-offset-4 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Partidas
          </Link>
        </GlassCard>
      </div>
    </ArenaShell>
  );
}
