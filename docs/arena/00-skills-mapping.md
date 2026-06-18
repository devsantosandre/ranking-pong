# 00 — Mapeamento de Skills (skills.sh)

> Qual skill do [skills.sh](https://skills.sh) é usada em cada doc e PR da Arena.
> As skills instaladas ficam em `.agents/skills/` e são invocadas via `/nome-da-skill`.

## Skills instaladas neste projeto

| Skill | Repositório | Quando invocar |
|---|---|---|
| `/frontend-design` | anthropics/skills | Antes de criar/revisar qualquer tela ou componente visual |
| `/web-design-guidelines` | vercel-labs/agent-skills | Após cada PR com mudanças de UI — audita acessibilidade e boas práticas |
| `/vercel-react-best-practices` | vercel-labs/agent-skills | Ao escrever componentes, hooks, data fetching, animações |
| `/next-best-practices` | vercel-labs/next-skills | Ao definir rotas, RSC boundaries, server actions, Suspense |
| `/improve-codebase-architecture` | mattpocock/skills | Antes de criar módulos novos — garante interfaces profundas |
| `/handoff` | mattpocock/skills | Ao encerrar uma sessão — compacta contexto para a próxima |

---

## Por documento

| Doc | Skill(s) | Momento |
|---|---|---|
| **01 — Visão & Produto** | — | Referência; sem skill específica |
| **02 — Arquitetura** | `/next-best-practices` + `/improve-codebase-architecture` | Antes de criar qualquer nova rota ou módulo |
| **03 — Design System** | `/frontend-design` + `/web-design-guidelines` | Antes de criar primitivos; depois de implementar para auditoria |
| **04 — Modernização Stack** | `/vercel-react-best-practices` + `/next-best-practices` | Ao configurar libs e padrões de bundle |
| **05 — Performance** | `/vercel-react-best-practices` | Ao implementar animações, realtime, virtualização |
| **06 — Animações** | `/vercel-react-best-practices` | Cada animação nova — confirmar GPU-only + prefers-reduced-motion |
| **07 — Dados & Backend** | `/improve-codebase-architecture` | Ao definir interfaces do repo/RPC |
| **08 — Torneios formatos** | — | Referência de regras; sem skill específica |
| **09 — Diferenciais** | `/frontend-design` | Para os recursos "uau" (ELO ao vivo, zebra, recap) |
| **10 — TV & Realtime** | `/vercel-react-best-practices` + `/frontend-design` | Layout de TV e performance de realtime |
| **11 — Execução & Roadmap** | `/handoff` | Ao encerrar cada PR — gera handoff para a próxima sessão |

---

## Por PR

### PR0 — Fundação Arena
**Skills:** `/frontend-design` → decisões de design system, glass, tipografia  
**Skills:** `/vercel-react-best-practices` → LazyMotion, CSS > JS, GPU-only  
**Após o PR:** `/web-design-guidelines` → auditoria de acessibilidade

### PR1 — Migrations + Tipos + Repo
**Skills:** `/improve-codebase-architecture` → definir interface do TournamentRepo  
**Skills:** `/next-best-practices` → server actions com assertAdmin + zod + revalidateTag

### PR2 — Bracket de Leitura
**Skills:** `/frontend-design` → anatomia do bracket, conectores, glass cards  
**Skills:** `/vercel-react-best-practices` → memoizar layout, virtualizar, coalesce realtime  
**Após o PR:** `/web-design-guidelines` → auditoria de acessibilidade do bracket

### PR3 — Admin MVP
**Skills:** `/next-best-practices` → RSC vs client islands, Suspense boundaries  
**Skills:** `/vercel-react-best-practices` → dnd-kit performance, re-renders no ScoreSheet

### PR4 — TV modo torneio
**Skills:** `/vercel-react-best-practices` → fit automático, anti burn-in, ambient glows GPU  
**Skills:** `/frontend-design` → projeção de bracket na TV, legibilidade em distância

### Entre PRs (ao encerrar sessão)
**Sempre:** `/handoff` — compacta o estado atual para a próxima conversa

---

## Uso autônomo (quando o modelo decide sem prompt do usuário)

O modelo pode invocar qualquer skill acima **automaticamente** nos seguintes gatilhos:

- Criou ou editou um componente visual → `/web-design-guidelines` na revisão
- Está prestes a escrever uma animação → `/vercel-react-best-practices` primeiro
- Está definindo uma nova interface de módulo → `/improve-codebase-architecture` primeiro
- Encerrou um PR → `/handoff` para compactar contexto
