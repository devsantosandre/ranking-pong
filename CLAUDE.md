# CLAUDE.md

Instruções do projeto para o Claude Code. Para convenções gerais de repositório
(estrutura, build, commits, segurança), veja também `AGENTS.md`.

## Padrão de UI — use a skill `arena-design-pattern`

**OBRIGATÓRIO:** sempre que for criar ou alterar qualquer coisa visual — telas, páginas,
rotas, componentes de UI, layout, cores, ou uma feature que tenha interface — **invoque
primeiro a skill `arena-design-pattern`** e siga o padrão Arena descrito nela.

Quando prever que uma tarefa envolve frontend/UI, carregue a skill **antes** de escrever
o código, não depois. Ela é a fonte da verdade para:

- `ArenaShell` como shell (nunca `AppShell` em telas novas)
- `GlassCard` para cards
- Cores **só** via tokens CSS (`--arena-*`, `--state-*`) — nunca hex de marca/estado em JS/JSX (white-label + dark mode)
- Notação Tailwind v4 com parênteses: `text-(--arena-foreground)`
- Estados de loading / empty / error
- `ConfirmModal` em ações de impacto

Ao final de um trabalho de UI, rode o checklist da skill e garanta `npm run lint` +
`npx tsc --noEmit` limpos nos arquivos tocados.
