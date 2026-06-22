---
name: arena-design-pattern
description: Padrão de design e UI do app (Arena). Use SEMPRE que criar/editar telas, páginas, componentes visuais ou features com UI neste projeto — garante ArenaShell, GlassCard, tokens CSS temáveis (white-label/dark), notação Tailwind v4 correta e estados de loading/empty/error. Aciona em qualquer trabalho de frontend, nova rota, novo componente ou ajuste visual.
---

# Arena Design Pattern

Padrão visual único do app. Toda tela/componente novo ou alterado **deve** seguir isto.
Não use o `AppShell` legado nem cores cruas do Tailwind em telas novas — é o que estamos
migrando para fora.

## 1. Estrutura de tela

- Páginas do app ficam em `src/app/(arena)/<rota>/page.tsx`. **Não criar páginas fora do route group `(arena)/`** (exceto `tv/`, `login`, geração de OG image).
- Toda tela usa o shell `ArenaShell`, nunca `AppShell`:

```tsx
import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";

<ArenaShell title="Título" subtitle="..." showBack layoutWidth="compact">
  {/* conteúdo */}
</ArenaShell>
```

Props: `title` (obrigatório), `subtitle?`, `showBack?`, `layoutWidth?: "compact" | "wide" | "full"`.

- Admin também migra para `ArenaShell` (a direção é unificar tudo no Arena). Telas admin ainda em `AppShell` são **dívida**, não exemplo a copiar.
- Projeção de TV (`src/app/tv/*`) mantém tema dark próprio — exceção intencional.

## 2. Cards = GlassCard

Nunca montar card cru (`rounded-2xl border bg-card shadow`). Use `GlassCard`:

```tsx
<GlassCard variant="strong" glow="primary" className="flex items-center gap-3">…</GlassCard>
```

- `variant`: `"default" | "strong" | "elevated"`
- `glow`: `"none" | "primary" | "active" | "scheduled" | "played"`
- `noPadding`: remove o `p-4` padrão (use quando precisar de padding próprio)
- Card clicável = `<Link href><GlassCard noPadding className="group … transition-all hover:scale-[1.01]">`

## 2.1 Espaçamento e densidade (canônico — não improvisar)

Estes valores são fixos. Não use `space-y-*`, `p-4`, `h-10` etc. "no olho" — copie daqui
(extraído de `admin/torneios/page.tsx` e `admin/page.tsx`):

- **Container da página:** `flex flex-col gap-4` (entre blocos/seções). Não use `space-y-4`.
- **Lista vertical de cards:** `flex flex-col gap-2` (cards de lista ficam **juntinhos**, gap-2). Não use `space-y-3`.
- **Card de item de lista:** `GlassCard noPadding className="group flex items-center gap-3 px-3 py-3 transition-all hover:scale-[1.01]"`. Padding do item é **`px-3 py-3`**, nunca `px-4 py-4`.
- **Card de conteúdo (não-lista):** `GlassCard` com padding padrão (`p-4`) — só não passar `noPadding`.
- **Chip de ícone (avatar de item):** `h-11 w-11 shrink-0 rounded-xl` + ícone `h-5 w-5`. Para avatar redondo de pessoa, `rounded-full`; para ícone de seção/categoria, `rounded-xl`.
- **Gap interno ícone↔texto:** `gap-3`. Linha de metadados: `gap-1.5`.
- **Empty state:** `GlassCard className="flex flex-col items-center gap-4 py-12 text-center"`.

Regra de ouro: antes de definir espaçamento, abra `admin/torneios/page.tsx` e copie o
mesmo esquema. Densidade inconsistente entre telas é bug de padrão.

## 2.2 Modais e sheets — o modal é "uma página dentro do modal"

O modal NÃO é um bloco translúcido nem um slab chapado. Ele reproduz a **composição das
páginas**: um canvas escuro sólido com cards distintos por cima (profundidade), igual à Home.

- **Container do modal = o canvas da página:** `background: var(--arena-bg-1)` (sólido, opaco,
  adapta light/dark) + `border: 1px solid var(--glass-border)` (sutil) + `shadow`.
  - ❌ NÃO use `--glass-bg-strong`/`backdrop-blur` no container → fica translúcido/washed e
    empilha transparência com os cards internos.
  - ❌ NÃO use `--glass-border-strong` (é branco ~0.18 no dark) → "borda branca", fora do padrão.
    A borda do padrão é a sutil `--glass-border` (~0.10).
  - ❌ NÃO use `--popover` em modal/sheet (é roxo médio chapado → "tudo opaco"). `--popover`
    é **só** para menus/dropdowns/selects.
- **Cards internos = como numa página:** `GlassCard` ou superfície sólida `--arena-bg-2`
  (ex.: cards do `score-sheet` usam `color-mix(... var(--arena-bg-2))` + borda
  `color-mix(var(--arena-foreground) 8%, transparent)` — sutil, NÃO branca). Sobre o canvas
  `--arena-bg-1` eles ganham a mesma profundidade da Home.
- **Backdrop:** `fixed inset-0 z-[90] flex bg-black/50 backdrop-blur-sm`.
- **Responsivo:** mobile = bottom-sheet full-width (`items-end justify-center`, inner
  `w-full rounded-t-3xl`); desktop = card centralizado (`sm:items-center`, inner
  `sm:max-w-sm sm:rounded-3xl`).
- **Tamanho:** inner `max-h-[92dvh] overflow-y-auto` — nunca cortar em telas baixas/estreitas.
- **z-index:** `z-[90]` (acima do FAB `z-60` e da nav `z-50`).
- **Ações de impacto:** use `ConfirmModal` (`components/ui/confirm-modal.tsx`). Não reinvente.
- **⚠️ PORTAIS (Radix `Sheet`/`Dialog`/`Popover`/`Select`/`DropdownMenu`):** o conteúdo é
  portado para o `<body>`, **FORA do `.arena`** → os tokens `--arena-*`/`--state-*`/`--glass-*`
  ficam **indefinidos** (modal transparente, "tema não aplica"). Solução: **adicione
  `className="arena"`** ao `*Content` portado (o seletor `.dark .arena` ainda resolve o dark
  porque `.dark` está no `<html>`). Alternativa: usar SÓ tokens globais (`--background`,
  `--card`, `--popover`, `--border`, `--foreground`, `--muted-foreground`, `--primary`).
  Modais inline (um `<div className="fixed inset-0">` no JSX, sem portal) herdam o `.arena`
  do ancestral e não precisam disso.

Referência de ouro: `score-sheet` (`admin/torneios/[id]` e `chave/bracket-client-shell`) e a
sheet H2H em `(arena)/ranking/page.tsx` — container `--arena-bg-1`, cards internos sólidos.

## 3. Cores: SÓ tokens CSS — nunca hex em JS/JSX (white-label + dark)

O app vira white-label/multitenant e tem dark mode. **Cor de marca/estado hardcoded quebra os dois.**
Regra absoluta: **não criar dependência de cor em JS** — toda cor sai de uma CSS var.

Tokens disponíveis (definidos em `src/app/globals.css`, `.arena {}` light + `.arena.dark {}`):

| Token | Uso |
|---|---|
| `--arena-primary` | cor de marca / ações primárias |
| `--arena-foreground` | texto principal |
| `--arena-muted` | texto secundário |
| `--glass-bg`, `--glass-bg-strong`, `--glass-border`, `--glass-border-strong` | superfícies glass |
| `--state-active` | ao vivo / em andamento (ciano) |
| `--state-scheduled` | agendado / aviso (âmbar) |
| `--state-played` | concluído / sucesso (verde) |
| `--state-noshow` | erro / W.O. (vermelho) |
| `--state-tbd` | indefinido (cinza) |
| `--font-display` | fonte de títulos |

Padrões de aplicação:

```tsx
// texto — notação Tailwind v4 com PARÊNTESES (colchetes geram CSS inválido):
<p className="text-(--arena-foreground)" />
<p className="text-(--arena-muted)" />
// ❌ NUNCA colchetes: text-[--arena-foreground]   ❌ NUNCA paleta crua: text-slate-600
// (text-foreground/shadcn adapta ao dark e é tolerado, mas prefira text-(--arena-foreground))

// fundo tingido / ícone colorido — via style + color-mix:
<div style={{ background: `color-mix(in srgb, ${token} 14%, transparent)`, color: token }} />
// onde token = "var(--state-played)" etc.

// título com fonte display:
<p style={{ fontFamily: "var(--font-display)" }} />
```

Quando precisar de várias cores distintas (ex.: chips de seções/seeds), distribua entre
os tokens existentes (`--arena-primary`, `--state-*`). Não invente hex; se faltar variedade,
crie novos tokens no `.arena {}` (e no bloco dark) e referencie por `var(...)`.

### White-label + dark (já implementado)
- **Há UM knob por tenant: `--brand`** (em `.arena {}`). TODAS as superfícies (bg, texto,
  vidro, bordas) são derivadas dele via `color-mix` — no light e no dark. Trocar `--brand`
  recolore o app inteiro. **Não hardcode superfície**; se precisar, derive de `--brand`/`--arena-*`.
- **Dark mode está ativo.** Liga com a classe `.dark` no `<html>` (toggle em
  Perfil › Configurações, via `useTheme` em `src/lib/use-theme.ts` + `ThemeToggle`). O bloco
  dark é `.arena.dark, .dark .arena {}` em `globals.css`. No dark a marca é clareada
  (`color-mix(var(--brand) 72%, #fff)`) para contraste.

### §3.1 PADRÃO DARK — regras que evitam "card branco / texto sumido"
O dark é AUTOMÁTICO **se** você usar só tokens. Os bugs de dark vêm sempre destes 4 erros.
Antes de finalizar, faça um grep por cada um no que você tocou:

1. **NUNCA `color-mix(..., #ffffff)` nem `..., #fff)` como base.** Branco fixo = card branco no dark.
   - ❌ `color-mix(in srgb, ${cor} 8%, #ffffff)`
   - ✅ `color-mix(in srgb, ${cor} 12%, var(--arena-bg-2))` (base opaca que adapta)
2. **NUNCA `bg-white` / `bg-white/NN` em superfície de conteúdo.** Use `bg-transparent`,
   `bg-(--glass-bg)` ou `bg-(--arena-bg-2)`. (`bg-white/15` só é ok sobre o header roxo.)
3. **NUNCA paleta crua do Tailwind** (`bg-amber-50`, `text-green-600`, `from-yellow-50`,
   `border-red-200`, `bg-gray-100`…). Mapeie para token por significado:
   - sucesso/ganhou → `--state-played` · erro/perdeu/W.O. → `--state-noshow`
   - aviso/ouro/agendado → `--state-scheduled` · info/ao vivo → `--state-active`
   - marca/destaque → `--arena-primary` · neutro/indefinido → `--state-tbd`
   - tinta de fundo: `bg-(--state-x)/10..15`; borda: `border-(--state-x)/30`; texto: `text-(--state-x)`
4. **Texto sempre em token** (`text-(--arena-foreground)` / `text-(--arena-muted)`), nunca
   sobre um fundo claro fixo. Texto-token (branco no dark) sobre `bg-amber-50` (claro) = invisível.

Tokens shadcn (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`,
`bg-primary`, `bg-popover`) **adaptam** ao dark (são sobrescritos dentro de `.arena`), então
são aceitáveis — mas prefira os `--arena-*`/`--state-*` em código novo.

**Style maps fora do JSX também contam:** mapas de cor em `src/lib/*` (ex.: `divisions.ts`,
`use-achievements.ts`, `seed-colors.ts`) precisam dos mesmos tokens — foi onde o dark mais
escapou. Modais/sheets seguem a **§2.2** (container `--arena-bg-1`, NÃO `--popover`).

**Grep de verificação (deve voltar vazio nos arquivos tocados):**
`#ffffff|#fff\b|bg-white|(bg|text|border|from|via|to)-(amber|yellow|green|emerald|red|rose|blue|sky|cyan|violet|purple|fuchsia|pink|orange|slate|gray|zinc|indigo|teal|lime)-[0-9]`

### Exceções legítimas (não são violação)
- `#ffffff`/`#fff` como base de contraste em `color-mix(... #fff)`.
- Bibliotecas que exigem literal: QR code (`QRCode.toDataURL`), geração de `opengraph-image`.
- `src/app/tv/*` (projeção dark dedicada).

## 4. Estados obrigatórios

Toda tela que carrega dados cobre **loading / empty / error**. Reaproveite skeletons e os
componentes de `src/components/arena/`. Empty state com `GlassCard` centralizado.

## 5. Ações importantes = ConfirmModal

Toda ação destrutiva ou de impacto (excluir, finalizar, corrigir resultado confirmado,
regerar chave) passa por um modal de confirmação antes de executar. Para re-edição de algo
já confirmado, o texto deve avisar a consequência ("isto vai recalcular as fases seguintes").

## 6. Antes de criar, reutilize

Procure componente existente em `src/components/arena/`, `src/components/tournaments/`,
`src/components/bracket/`, `ui/`. Reuso > novo componente.

## Referências de ouro (copie o estilo destes)
- `src/app/admin/page.tsx` — landing com chips de seção via tokens
- `src/app/admin/torneios/page.tsx` — lista com `Link` + `GlassCard` hover
- `src/app/(arena)/torneios/[id]/page.tsx` — tela rica
- `src/components/arena/glass-card.tsx` / `arena-shell.tsx` — primitivas
- `src/app/globals.css` (`.arena {}`) — fonte da verdade dos tokens

## Checklist de revisão (rode mentalmente ao terminar)
- [ ] Usa `ArenaShell` (não `AppShell`)?
- [ ] Cards são `GlassCard` (não div cru)?
- [ ] Espaçamento canônico (§2.1): lista `flex flex-col gap-2`, item `px-3 py-3`, chip `h-11 w-11`? Não inventou `space-y-*`/`px-4`?
- [ ] Modal/sheet (§2.2): container `--arena-bg-1` + borda sutil `--glass-border` (não `--glass-border-strong` branca, não `--popover`)? Cards internos sólidos? `max-h-[92dvh]` + bottom-sheet no mobile?
- [ ] Se usa portal (Sheet/Dialog/Popover/Select): o `*Content` tem `className="arena"`? (senão os tokens arena somem fora do `.arena`)
- [ ] Zero hex de marca/estado em JS/JSX? Só `var(--…)` (fora das exceções da §3)?
- [ ] Padrão dark (§3.1): sem `#ffffff`/`#fff` em color-mix, sem `bg-white`, sem paleta crua, texto em token? (rodar o grep da §3.1)
- [ ] Conferi style maps em `src/lib/*` (toda cor via token)?
- [ ] Notação `text-(--token)` com parênteses, nunca colchetes nem `text-slate-*`?
- [ ] Loading / empty / error cobertos?
- [ ] Ação de impacto tem ConfirmModal?
- [ ] `npm run lint` + `npx tsc --noEmit` limpos nos arquivos tocados?
