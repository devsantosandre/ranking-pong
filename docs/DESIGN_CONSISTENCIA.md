# Guia de Consistência Visual

Objetivo: toda tela/feature nova nasce harmônica com o app existente. **Regra de ouro: reusar > inventar.** Antes de criar um componente, procure um equivalente em `src/components` e `src/components/ui`.

## Layout base
- Toda página usa `AppShell` (`src/components/app-shell.tsx`) com `title`, `subtitle` e `showBack` quando fizer sentido.
- Container de conteúdo: empilhar blocos com `space-y-4`.
- Mobile-first (PWA). Pensar primeiro em telas estreitas; refinos `sm:` depois.

## Cards / superfícies
- Card padrão: `rounded-2xl border border-border bg-card p-3 shadow-sm` (variações `p-4`, `rounded-xl` para itens menores).
- Faixas/realces sutis: `rounded-xl border bg-muted/40` (neutro) ou `border-primary/25 bg-primary/5` (destaque).
- Itens clicáveis: `transition active:scale-[0.995]` e `cursor-pointer`; quando desabilitado, `cursor-default`.

## Cores e estados (NÃO hardcode)
- Use tokens do tema: `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-muted`, `border-border`, `text-primary`, `bg-primary/10`.
- Resultado positivo/vitória: família `emerald`/`green` (`text-emerald-700`, `bg-emerald-50`, `text-green-600`).
- Resultado negativo/derrota: família `red` (`text-red-600`, `bg-red-50`).
- **Ranking/posições e divisões**: SEMPRE reusar `src/lib/divisions.ts` (`getPlayerStyle`, `getDivisionStyle`, `getDivisionNumber`, `getDivisionName`, `isTopThree`). O ranking de Temporada deve usar exatamente esses helpers → consistência automática com o Geral.

## Tipografia
- Números/pontos: `font-bold tabular-nums` (evita "pulo" de largura).
- Rótulos pequenos: `text-[11px]`/`text-xs text-muted-foreground`, muitas vezes `font-semibold uppercase tracking-wide` para microtítulos.
- Hierarquia: título do card `text-sm font-semibold`; valor de destaque `text-2xl`/`text-3xl font-bold`.

## Estados de tela (sempre os três)
- **Loading**: usar skeletons de `src/components/skeletons` (ex.: `PlayerListSkeleton`). Não usar spinner solto onde já existe skeleton equivalente.
- **Vazio**: `p-8 text-center text-sm text-muted-foreground` com mensagem clara.
- **Erro**: `text-center text-sm text-red-500` (ou card `border-red-200 bg-red-50 text-red-600`).

## Componentes a reusar
- Abas: `src/components/ui/tabs.tsx` (usar para alternar **Temporada / Geral**).
- Painel deslizante/detalhe: `Sheet` (`src/components/ui/sheet.tsx`), como no H2H do ranking.
- Busca: padrão `SearchInput` já existente em `ranking/page.tsx`.
- Botões: `Button` (`variant="outline"`, `size="sm"`), `LoadMoreButton`, `ConfirmModal` para ações destrutivas/admin.
- Ícones: `lucide-react` (mesmo set já usado).

## Dados / hooks
- Toda leitura via React Query em `src/lib/queries` (criar `use-seasons.ts` no mesmo padrão de `use-users.ts`), com `queryKeys` centralizados em `query-keys.ts`.
- Mutations/admin via Server Actions em `src/app/actions` (padrão de `actions/admin.ts`).
- Manter nomes de enums/colunas iguais ao Supabase; tipos espelhados no TS.

## Microinterações
- Transições leves (`transition`, `duration-500` em barras de progresso), nada exagerado.
- Feedback de ação (toast/inline) curto e claro, em português correto (com acentuação).

## Checklist antes de finalizar uma tela
1. Reusei `AppShell`, tokens de cor e `divisions.ts`?
2. Tem os três estados (loading/vazio/erro)?
3. Números com `tabular-nums`? Acentuação correta nos textos?
4. Passa no `npm run lint` e `npm run build`?
