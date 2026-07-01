# Plano — Torneios: Grupos, Desempate Oficial e Inscrição

> **Status:** 📋 Especificação aprovada para implementar (ainda NÃO implementado).
> **Branch:** `develop`.
> **Escopo:** 5 melhorias no módulo de torneios (Arena v2), agrupadas em 4 blocos de trabalho.
> **Regra do projeto:** nunca aplicar migrations em produção — apenas criar os arquivos; o usuário aplica manualmente.

## Sumário das decisões (já alinhadas com o usuário)

| # | Item | Decisão |
|---|------|---------|
| 1+5 | Dimensionar grupos | Remover trava de 8 grupos e a exigência de potência de 2. Preferir grupos de **3**, aceitando **2 e 4**. Mata-mata fecha com **byes**. |
| — | Classificados por grupo | **Top 2** de cada grupo avançam (padrão ITTF/CBTM). |
| 4 | Desempate (só grupos) | **Oficial ITTF/CBTM**: pontos de vitória → razão de sets → razão de pontos de game, recalculado **somente entre os empatados**. Exige capturar o placar de cada set. |
| 3 | Inscrição nativa | **Substituir o Google Forms**: inscrição de **evento** (até 2 divisões, 1 pagamento), página de informações, **pagamento PIX automático via Mercado Pago** (webhook confirma sem comprovante; conta do organizador), seed por **rating CBTM** (`pots`). Detalhado no Bloco C a partir do form real do "6º Aberto da Smash Pong". |
| 2 | Remover em massa | Checkboxes de seleção + "Remover selecionados" com `ConfirmModal`. |

### Ordem de execução (priorização do usuário)
**Prioridade = fazer o torneio/ranking rodar bem primeiro**, validado com o cliente em vários testes. A inscrição entra depois, **simulada** (sem terceiros). A conexão com o **Mercado Pago fica por último**, isolada, por envolver integração externa.

**Fase 1 — Motor do torneio (núcleo):**
1. **Bloco A** (itens 1+5: grupos)
2. **Bloco B** (item 4: desempate ITTF)
3. **Bloco D** (item 2: remoção em massa) — pequeno, ajuda nos testes com o cliente

→ *Checkpoint: rodar torneios de ponta a ponta, testar e ajustar com o cliente até o motor estar sólido.*

**Fase 2 — Inscrição simulada (sem pagamento real):**
4. **Bloco C** nos modos `manual`/`free` (C4 seed → C1 página de informações → C2 formulário nativo + `event_signups`). Inscrição funciona de ponta a ponta com **confirmação manual do admin** — **nenhuma dependência externa**.

→ *Checkpoint: simular inscrições reais de evento, validar fluxo e UX com o cliente.*

**Fase 3 — Pagamento (por último, integração externa):**
5. **C3 — Mercado Pago** (cobrança PIX + webhook). É puramente **aditivo**: liga o modo `gateway` sobre uma inscrição que já funciona. Só aqui aparece a dependência de terceiro.

Cada bloco é commitável e testável isoladamente. **A divisão por modo de pagamento (`gateway|manual|free`) é o que permite simular tudo antes do Mercado Pago.**

---

## Contexto técnico atual (estado do código)

Arquivos centrais (branch `develop`):

| Camada | Arquivo |
|--------|---------|
| Tipos/modelo | `src/lib/tournaments/types.ts` |
| Semeadura | `src/lib/tournaments/seeding.ts` |
| Classificação grupos | `src/lib/tournaments/standings.ts` |
| Lançar placar | `src/components/tournaments/score-sheet.tsx` |
| Distribuição grupos (board DnD) | `src/components/tournaments/group-distribution-board.tsx` |
| Tela admin (abas) | `src/app/admin/torneios/[id]/page.tsx` (`GroupsTab` ~L1011) |
| Auto-inscrição | `src/app/(arena)/torneios/[id]/inscrever/page.tsx` |
| Server actions | `src/app/actions/tournaments.ts` |
| Schema | `supabase/migrations/20260617000000_tournaments.sql` |

Schema relevante (já existente):
- `tournament_participants`: tem `seed int`, `group_id text`, **`pot int`** (livre — usaremos para a pontuação da inscrição).
- `tournament_matches`: tem `score_a/score_b int` (sets ganhos) e **`sets jsonb`** (placar set-a-set — **existe mas a UI não preenche**).
- `reportResult` (action) já aceita `sets?` opcional; o `ScoreSheet` simplesmente não envia.

---

## BLOCO A — Dimensionamento de grupos (itens 1 + 5)

> 📚 **Base oficial:** ver `docs/ESTUDO_DISTRIBUICAO_GRUPOS_ITTF_CBTM.md` — snake (ITTF 3.6), chaveamento dos classificados (ITTF 3.7), byes e especificidades CBTM (rating, separação por delegação, grupos 3–4, top 2).

### A.1 Objetivo
Suportar de campos pequenos (8) a grandes (100+) com grupos de tamanho **2/3/4 (preferência 3)**, **top 2** avançando, e o mata-mata completando-se com **byes** quando o nº de classificados não for potência de 2.

### A.2 Estado atual e o que muda
Em `GroupsTab` (`src/app/admin/torneios/[id]/page.tsx`):
- `maxG = Math.min(Math.floor(confirmed.length / 2), 8)` → **remove o teto de 8**.
- Lógica que marca "mata-mata incompleto" quando classificados não é potência de 2 (`valid = total & (total-1) === 0`) → **remove**; byes resolvem.
- `spots = Math.max(1, Math.ceil(minSize / 2))` (classificados por grupo derivado do tamanho) → **substituir por `2` fixo** (top 2).

### A.3 Algoritmo de dimensionamento (novo)
Novo arquivo: `src/lib/tournaments/group-planner.ts`.

```ts
/** Distribui n jogadores em grupos de tamanho 2/3/4, preferindo 3.
 *  Retorna a lista de tamanhos, ex.: planGroupSizes(20) => [4,4,3,3,3,3]. */
export function planGroupSizes(n: number): number[] {
  if (n <= 1) return n === 1 ? [1] : [];
  if (n <= 4) return [n];               // 2,3,4 => grupo único; round-robin

  // Faixa de g (nº de grupos) que mantém todo grupo em {3,4}: 3g <= n <= 4g
  const gMin = Math.ceil(n / 4);
  const gMax = Math.floor(n / 3);

  // Preferência por grupos de 3 => maximiza nº de grupos => g = gMax.
  let g: number;
  if (gMax >= gMin) {
    g = gMax;                            // todos os grupos ficam com 3 ou 4
  } else {
    g = Math.max(1, Math.round(n / 3));  // não há split só-3/4: permite um grupo de 2
  }

  const base = Math.floor(n / g);
  const rem = n - base * g;              // 'rem' grupos recebem base+1
  const sizes: number[] = [];
  for (let i = 0; i < g; i++) sizes.push(i < rem ? base + 1 : base);
  return sizes.sort((a, b) => b - a);    // maiores primeiro (estético)
}
```

**Exemplos numéricos (casos de aceite):**

| n | g | tamanhos | classificados (2/grupo) | bracket KO | byes |
|---|---|----------|--------------------------|------------|------|
| 8 | 2 | 4,4 | 4 | 4 | 0 |
| 12 | 4 | 3,3,3,3 | 8 | 8 | 0 |
| 20 | 6 | 4,4,3,3,3,3 | 12 | 16 | 4 |
| 24 | 8 | 3×8 | 16 | 16 | 0 |
| 30 | 10 | 3×10 | 20 | 32 | 12 |
| 100 | 33 | 4×1 + 3×32 | 66 | 128 | 62 |

> Observação: o usuário pode sempre **sobrescrever** a sugestão arrastando no `GroupDistributionBoard` (já existe). `planGroupSizes` apenas define o **default**.

### A.4 Semeadura nos grupos
Manter a distribuição "cobra/serpentina" já existente em `computePreview` (1 forte por grupo, alternando direção a cada rodada de seeds). Adaptar para receber `planGroupSizes(n)` em vez de `numGroups` fixo, mas o efeito é o mesmo: seeds ordenados por força distribuídos coluna a coluna.

### A.5 Montagem do mata-mata a partir dos grupos (com byes)
Os 2 primeiros de cada grupo geram `Q = 2·g` classificados. O bracket tem tamanho `nextPowerOfTwo(Q)`; `byes = nextPowerOfTwo(Q) − Q`.

**Regra de posicionamento (padrão ITTF, evitar reencontro precoce):**
1. Vencedores de grupo recebem seeds **1..g**; vices recebem **g+1..2g**.
2. Ordenar vencedores entre si e vices entre si pelo desempenho na fase de grupos (pontos, razões) — ou pelo seed original como fallback.
3. Posicionar com `buildStandardOrder(nextPow2(Q))` (já existe em `seeding.ts`) de modo que:
   - 1º e 2º do **mesmo grupo** fiquem em metades opostas (não se cruzam antes da final);
   - os **byes** caiam nos seeds mais altos (1º colocados dos melhores grupos).

> A função `generateBracket` no repo (`supabase-repo.ts` / RPC) já monta o KO pós-grupos. **Checkpoint de implementação:** confirmar se o emparelhamento grupo→KO está no TS ou numa RPC SQL e aplicar a regra de separação lá. Hoje `configureGroups` chama `repo.generateBracket(id, "standard")`.

### A.6 UI (GroupsTab)
- Seletor de nº de grupos: continuar permitindo escolha manual, mas **pré-selecionar** `planGroupSizes(n).length` e exibir resumo: *"11 grupos · 9 de 3 e 2 de 4 · 22 classificados → mata-mata de 32 (10 byes)"*.
- Remover os badges/avisos de "mata-mata incompleto" e "potência de 2". Substituir por aviso informativo de byes quando houver.
- Manter o board drag-and-drop para ajuste fino.

### A.7 Arquivos afetados
- **Novo:** `src/lib/tournaments/group-planner.ts` (+ teste).
- `src/app/admin/torneios/[id]/page.tsx` — `GroupsTab`: remover travas, usar `planGroupSizes`, top-2 fixo, resumo de byes.
- `src/lib/tournaments/seeding.ts` — garantir separação 1º×2º do mesmo grupo no KO (helper `seedQualifiersIntoBracket`).
- **Checkpoint SQL:** revisar emparelhamento grupo→KO em `supabase-repo.ts`/RPC.

### A.8 Casos de borda
- n < 4: grupo único / round-robin (não cai aqui se formato exige grupos).
- Grupo com 2 jogadores: 1 só partida; top 2 = todos avançam (válido na regra; sinalizar visualmente).
- Número ímpar de classificados por causa de top-2 nunca ocorre (2·g é sempre par), mas o bracket pode precisar de byes.

---

## BLOCO B — Desempate oficial ITTF/CBTM (item 4)

### B.1 Objetivo
Na **fase de grupos**, capturar o placar de **cada set** e desempatar pelos critérios oficiais. No **mata-mata**, nada muda (continua só sets ganhos).

### B.2 Regra oficial (ITTF Laws 3.7.6 / CBTM)
Classificação por **pontos de vitória** (oficial: **2 por vitória, 1 por derrota disputada, 0 por W.O.**).

Havendo **empate de pontos entre 2+ jogadores**, considera-se **apenas os jogos entre os empatados**, na ordem:
1. **Pontos de vitória** entre os empatados;
2. **Razão de sets** = (sets ganhos ÷ sets perdidos) entre os empatados;
3. **Razão de pontos** = (pontos de game ganhos ÷ pontos de game perdidos) entre os empatados.

> Aplicação **progressiva**: assim que um subconjunto é desempatado, ele sai do cálculo e o processo recomeça entre os que continuam empatados. (Fonte: ITTF Handbook 3.7.6; confirmado em [allabouttabletennis.com](https://www.allabouttabletennis.com/calculation-of-group-ranking.html) e [pingskills](https://www.pingskills.com/table-tennis-forum/ranking-in-group-tournament).)

**Observação sobre pontos por vitória:** o código hoje usa **3 por vitória**. Em grupo completo (todos jogam o mesmo nº de partidas) a ordenação por 3·V é idêntica à de 2·V+1·D. Mudaremos para **2/1** para fidelidade oficial e para tratar W.O. corretamente. Impacto visual mínimo.

### B.3 Modelo de dados
- Usar o campo existente **`tournament_matches.sets jsonb`** = `Array<[number, number]>`, um par por set: `[[11,7],[9,11],[11,8]]`.
- **Nenhuma migration nova** necessária para o item 4 (coluna já existe). `GroupStanding` ganha campos derivados em memória: `gamePointsWon`, `gamePointsLost` (não persistidos; calculados).

### B.4 Captura do placar set-a-set (ScoreSheet)
`src/components/tournaments/score-sheet.tsx`:
- Quando `match.bracket === "group"` (ou prop `captureSets`), exibir, abaixo do placar de sets, uma linha por set com dois inputs numéricos (pontos A × pontos B).
- Validações por set: vencedor com ≥ 11 e diferença ≥ 2 (ou ≥ deuce). O vencedor do set deve coincidir com quem somou aquele set no placar agregado.
- Nº de sets exibidos = `scoreA + scoreB` (sets já decididos). Enviar `sets` no `reportResult`.
- Mata-mata: comportamento atual intacto (sem inputs de pontos).

### B.5 Cálculo (standings.ts)
Reescrever `computeGroupStandings` para:
1. Montar stats por jogador (vitórias, sets ±, pontos de game ± — estes lidos de `m.sets`).
2. Ordenar por pontos de vitória.
3. Para blocos empatados, chamar `breakTies(tiedPlayers, groupMatches)` que aplica recursivamente os 3 critérios usando **somente as partidas entre os empatados**.

```ts
// Pseudocódigo do desempate (mini-tabela entre empatados)
function breakTies(tied: Stats[], matches: Match[]): Stats[] {
  if (tied.length <= 1) return tied;
  const ids = new Set(tied.map(t => t.id));
  const mini = matches.filter(m => ids.has(m.a) && ids.has(m.b)); // só entre empatados
  // 1) pontos de vitória no mini; 2) razão de sets; 3) razão de pontos
  const ranked = sortBy(tied, [
    t => -miniMatchPoints(t, mini),
    t => -ratio(miniSetsWon(t, mini), miniSetsLost(t, mini)),
    t => -ratio(miniPointsWon(t, mini), miniPointsLost(t, mini)),
  ]);
  // aplicação progressiva: separa quem já está distinto e recursa nos ainda-iguais
  return splitAndRecurse(ranked, mini);
}
```

`ratio(w, l)` = `l === 0 ? (w === 0 ? 0 : Infinity) : w / l`.

### B.6 UI da classificação
`standings-table.tsx` e a tabela em `GroupsTab`:
- Adicionar colunas/tooltip: **Pts de game** (ganhos–perdidos) e indicação de quando a posição foi decidida por desempate.
- Legenda explicando o critério aplicado.

### B.7 Arquivos afetados
- `src/lib/tournaments/standings.ts` — reescrita do cálculo + desempate ITTF (+ testes com cenários de empate triplo).
- `src/components/tournaments/score-sheet.tsx` — inputs de placar por set na fase de grupos.
- `src/app/actions/tournaments.ts` — `reportResultSchema` já aceita `sets`; reforçar validação set-a-set.
- `src/components/tournaments/standings-table.tsx` + `GroupsTab` — exibir pontos de game.
- **Checkpoint SQL:** existe a view/agregação `tournament_*` (migration `20260617000200_tournament_realtime.sql`) somando sets. Confirmar se a **classificação exibida** vem do TS `computeGroupStandings` (provável) ou de RPC/view; o desempate ITTF precisa estar onde a ordenação realmente acontece. Se for SQL, replicar lá ou mover ordenação para o TS.

### B.8 Casos de borda
- Set sem placar detalhado (`sets` nulo p/ jogos antigos): razão de pontos cai para 0/neutra; não quebra.
- Empate triплo/quádruplo: o `breakTies` recursivo cobre.
- W.O.: vitória sem sets → tratar pontos de vitória conforme regra e razões neutras.

---

## BLOCO C — Inscrição nativa de evento (substitui o Google Forms) (item 3)

### C.0 O que o formulário real revela
Referência: Google Forms do **"6º Aberto da Smash Pong"** (centro de treinamento, evento com 4 etapas/ano). O formulário **não** é uma inscrição de torneio único — é uma inscrição **de evento**, onde o atleta escolhe **até 2 divisões** e paga **uma vez** (R$70 por 1 divisão, R$90 por 2). Isso encaixa **exatamente** no nosso modelo `tournament_events` → divisões (cada divisão é um `Tournament`).

O Google Forms também tem um **cabeçalho rico de informações** (data, local, horários por divisão, formato MD5, valores/PIX, premiação, prazo, contato). O usuário destacou *"tem espaço para colocar informações"* → precisamos de uma **página pública de informações do evento** que substitua esse cabeçalho.

**Conclusão de design:** o objetivo do Bloco C é **substituir o Google Forms por uma experiência nativa de inscrição de evento**, com: (C1) página de informações, (C2) formulário nativo + modelo de inscrição, (C3) pagamento PIX via gateway (sem upload de arquivos), (C4) seed automático por rating CBTM.

### C.1 Campos reais do formulário (extraídos das telas)
| # | Pergunta (rótulo exato) | Tipo | Obrig. | Mapeia para |
|---|-------------------------|------|--------|-------------|
| 1 | E-mail | texto | ✅ | `signup.email` |
| 2 | Nome completo | texto | ✅ | `signup.full_name` → `participant.guest_name` |
| 3 | 🏓 Você representa algum clube? (nome do clube) | texto | ✅ | `signup.club` |
| 4 | 🏓 Você é filiado à CBTM? (se sim, pontos no **Rating**) | texto | — | `signup.cbtm_rating` → **seed (`pot`)** |
| 5 | Telefone para contato (com DDD) | texto | ✅ | `signup.phone` |
| 6 | **Escolha da Divisão** — até 2 (A,B,C,D,E,FEMININA,KIDS Sub-11) | checkboxes | ✅ | `signup.divisions[]` → 1 `participant` por divisão |
| 7 | 💰 Pagamento (PIX; R$70/1, R$90/2) | — | ✅ | gateway MP (QR PIX) ou `manual`; **sem anexo/upload** |
| 8 | ✅ Concordância com as regras | checkbox "Sim" | ✅ | `signup.agreed_rules` |
| 9 | [Opcional] Observação | parágrafo | — | `signup.notes` |

Regras de negócio embutidas no form:
- **Máximo 2 divisões** ("se marcar mais, valem as 2 primeiras") → validar no app.
- **Divisões são por nível** (E = iniciante … A = avançado) → seed por rating faz sentido dentro da divisão.
- **Inscrição só confirma após o pagamento** → `signupStatus` fica `signed_up` (pendente) até confirmar: no modo `gateway`, o **webhook do Mercado Pago**; no modo `manual`, o **admin marca pago**. Sem comprovante armazenado.
- **Premiação condicional** (ex.: >90 inscritos libera prêmio) → é conteúdo informativo da página (C1), não regra de sistema.

### C.2 Arquitetura de dados — entidade `event_signups` (recomendado)
O pagamento e os dados de contato são **por pessoa por evento**, não por divisão. Modelar uma inscrição que gera **N participações** (1 por divisão escolhida) é mais limpo do que duplicar contato/pagamento em cada `participant`.

**Nova tabela** `event_signups` (migration `supabase/migrations/<ts>_event_signups.sql`):
```sql
create table event_signups (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references tournament_events(id) on delete cascade,
  full_name       text not null,
  email           text,
  phone           text,
  club            text,
  cbtm_affiliated boolean not null default false,
  cbtm_rating     int,                       -- base do seed (pot)
  divisions       text[] not null,           -- rótulos escolhidos (máx 2)
  amount_cents    int,                        -- valor cobrado (preço × nº divisões)
  payment_mode    text not null default 'gateway', -- gateway|manual|free
  payment_provider text,                      -- 'mercadopago' (quando gateway)
  payment_id      text,                       -- id da cobrança no gateway
  payment_status  text not null default 'pending', -- pending|confirmed|rejected|expired
  agreed_rules    boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now()
);
```
- Ao **confirmar** (webhook do gateway no modo `gateway`, ou admin no modo `manual`): para cada divisão em `divisions`, cria/confirma um `tournament_participants` com `guest_name = full_name`, `pot = cbtm_rating`, `signup_status = 'confirmed'`, vinculado ao `Tournament` daquela divisão. (Se o atleta tem conta no app, casar `user_id` por e-mail.)
- `payment_status = rejected` → notifica/permite reenvio; não cria participantes.

> **Alternativa lean (sem tabela nova):** denormalizar contato/pagamento em cada `tournament_participants` e agrupar por e-mail na visão de pagamentos. Mais simples, mas trata mal o "1 pagamento p/ 2 divisões". **Recomendação: `event_signups`.**

### C.3 Página de informações do evento (C1)
O cabeçalho do Forms vira conteúdo do **evento**. Em vez de muitas colunas, usar um blob flexível (white-label friendly):

**Migration:** `alter table tournament_events add column info jsonb;`
```jsonc
// event.info — todos opcionais; editor no admin
{
  "description": "markdown com o texto-convite",
  "registrationDeadline": "2026-05-01",
  "contactPhone": "(61) 99425-4592",
  "payment": { "mode": "gateway",          // gateway | manual | free
               "provider": "mercadopago",
               "prices": { "1": 70, "2": 90 },
               // credenciais do organizador (cifradas; nunca no client):
               "mpAccountRef": "<id do tenant/credencial MP>" },
  "prizeInfo": "markdown de premiação por divisão",
  "rulesText": "markdown das regras (p/ a concordância)"
}
```
- Por **divisão** (no `Tournament`): `start_time text` (ex.: "10h20") e `level_description text` (ex.: "iniciante"). Migration: `alter table tournaments add column start_time text, add column level_description text;`
- **Página pública** `src/app/(arena)/eventos/[id]/page.tsx` (já existe) ganha: banner/branding, descrição (markdown), grade de horários por divisão, premiação, info de pagamento, prazo, contato e **CTA "Inscrever-se"**.

### C.4 Fluxo de pagamento (C3) — gateway PIX automático (Mercado Pago)
**Decisão:** automatizar via **Mercado Pago** (PIX + webhook), com a conta **do organizador** (credenciais por tenant). Sem comprovante manual no caminho feliz.

> **Sem armazenamento de arquivos.** Decisão do usuário: **não guardar comprovantes** (custo de Storage/infra fica com o organizador). Nenhum modo faz upload — não há bucket Supabase Storage neste plano.

**Modos de pagamento por evento** (`info.payment.mode`):
- `gateway` — cobrança PIX automática (padrão quando o organizador conectou o MP);
- `manual` — admin **marca como pago** manualmente (zero arquivos; eventual comprovante é tratado fora do app, ex.: WhatsApp);
- `free` — evento gratuito (ex.: KIDS): confirma direto, sem pagamento.

**Fluxo `gateway`:**
```
inscrição criada (pending)
→ app chama MP (token do organizador) e cria cobrança PIX (valor = preço por nº de divisões)
→ mostra QR + copia-e-cola na tela de sucesso (e por e-mail/link)
→ atleta paga → MP dispara webhook → app valida assinatura + idempotência
→ payment_status = 'confirmed' → cria/confirma participantes nas divisões
```
- **Rota webhook:** `src/app/api/payments/webhook/route.ts` — valida assinatura MP, idempotente (mesmo evento pode chegar 2×), atualiza `event_signups` e gera participantes.
- **Expiração:** cobrança PIX com validade; inscrição não paga expira (libera vaga). Reenvio de QR disponível.
- **Recebimento:** dinheiro cai **direto na conta MP do organizador** (token salvo por tenant; nada transita pela plataforma). Split/marketplace fica como evolução futura, sem retrabalho de modelagem.
- **Credenciais por tenant:** `access_token` (e `public_key`) do Mercado Pago do organizador, guardados cifrados na config do tenant/evento. Nunca no client.

**Modo `manual`:** sem upload. O painel admin lista as inscrições `pending` e o admin **Confirma/Rejeita** (com `ConfirmModal`). Nenhum arquivo é armazenado.

#### C.4.1 Quem valida o pagamento — a app NÃO confirma sozinha
**A fonte da verdade do dinheiro é sempre o Mercado Pago.** A aplicação **não** vê extrato, saldo, nem "valida no olho" — ela apenas **pergunta ao MP e confia na resposta do MP**. O dinheiro cai direto na conta do organizador (cobrança criada com o token dele); a plataforma **nunca toca no dinheiro** (sem responsabilidade financeira / sem KYC de marketplace).

```
App → MP:    cria cobrança PIX (token do organizador) → recebe payment_id
Atleta → Banco: paga o PIX
MP → conta do organizador: dinheiro entra   ← MP valida o recebimento
MP → App:    webhook "payment.updated" (payment_id)
App → MP:    GET /v1/payments/{id}  → status == 'approved'?  ← validação da app
App:         inscrição = confirmed, gera participantes
```

#### C.4.2 Segurança do webhook (obrigatório na implementação)
Um webhook **não é confiável por si só** — qualquer um pode mandar um POST falso dizendo "pagou". Por isso a rota `src/app/api/payments/webhook/route.ts` faz **três checagens**, todas contra o próprio MP / o próprio banco:

1. **Validação de assinatura (HMAC).** O MP assina cada notificação com o header `x-signature` (+ `x-request-id`). Recalcular o HMAC-SHA256 com o **`webhook secret`** do organizador sobre o template `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` e comparar (comparação tempo-constante). Assinatura inválida → `401`, ignora.
2. **Reconsulta na fonte (server-to-server).** **Nunca** confiar no corpo do webhook para saber o valor/status. Pegar só o `data.id` e fazer `GET /v1/payments/{id}` na API do MP (com o `access_token` do organizador). Confirmar: `status === 'approved'`, `transaction_amount === amount_esperado`, e que o `external_reference` casa com o `event_signups.id` que criamos. Qualquer divergência (valor menor, outro signup) → rejeita.
3. **Idempotência.** O MP **reenvia** a mesma notificação várias vezes (e exige resposta `200/201` rápida, < ~22s). Processar de forma idempotente: gravar o `payment_id` e, se já estiver `confirmed`, responder `200` sem reprocessar (não gerar participantes em duplicidade). Usar transação / `on conflict do nothing` por `payment_id`.

**Boas práticas adicionais:**
- Responder `200` **rápido**; trabalho pesado (gerar participantes) idealmente após o `ack`, mas como é leve, pode ser inline numa transação.
- **`external_reference`** = `event_signups.id` na criação da cobrança → permite casar webhook ↔ inscrição sem ambiguidade.
- **Conciliação de borda:** webhook pode falhar/atrasar. Manter um **fallback de polling** opcional (consultar status das cobranças `pending` antigas) e/ou botão admin "reconsultar pagamento" — ambos reusam o `GET /payments/{id}`. (Sem isso, uma inscrição paga poderia ficar presa em `pending` se o webhook se perder.)
- **Segredos por tenant:** `access_token` **e** `webhook secret` do organizador guardados cifrados; o `webhook secret` é por integração e necessário para o passo 1.
- Mapear status MP → interno: `approved`→`confirmed`; `pending/in_process`→`pending`; `rejected/cancelled`→`rejected`; `refunded/charged_back`→tratar (estorno).

> Resumo: **a app não decide que pagou — o MP decide.** A app só (1) confirma que a notificação veio mesmo do MP, (2) reconsulta o status real na API do MP e (3) aplica uma vez só.

### C.5 Seed automático por rating CBTM (C4)
`src/lib/tournaments/seeding.ts` — implementar o método ausente:
```ts
/** Semeia por pontuação informada (desc). Sem pontuação => fim da fila. */
export function potsSeeding(participants: TournamentParticipant[]): SeededParticipant[] {
  const sorted = [...participants].sort((a, b) => (b.pot ?? -1) - (a.pot ?? -1));
  return standardSeeding(sorted);
}
```
- `pot = cbtm_rating` na criação do participante. Não-filiados (sem rating) caem no fim; admin pode ajustar manualmente na aba Seeds.
- Ligar em `repo.generateBracket("pots")` e no `saveSeeding` quando `seedingMethod === "pots"`.

### C.6 Formulário nativo (C2)
- Nova página `src/app/(arena)/eventos/[id]/inscrever/page.tsx` (inscrição **por evento**, multi-divisão). Mantém a `/torneios/[id]/inscrever` atual para torneios avulsos.
- Campos da tabela C.1; validação Zod (máx 2 divisões; concordância obrigatória). **Sem campo de upload.** No modo `gateway`, a tela de sucesso exibe o QR PIX; no `manual`, instrui o pagamento e marca como pendente.
- Padrão de UI Arena (ArenaShell/GlassCard/tokens) — **invocar a skill `arena-design-pattern`** na implementação.
- Tela de sucesso: "inscrição recebida, aguardando confirmação do pagamento".

### C.7 Server actions + integração de pagamento
`src/app/actions/tournaments.ts`:
- `createEventSignup(eventId, input)` — valida (Zod), grava `event_signups` (`pending`). No modo `gateway`, cria a cobrança PIX no Mercado Pago (token do organizador) e retorna QR/copia-e-cola; no `free`, confirma direto.
- `confirmEventSignup` / `rejectEventSignup` — admin (modo `manual`); confirmar gera participantes.
- `updateEventInfo(eventId, info)` — edita o blob de informações (inclui modo/preços/credencial MP).

Integração Mercado Pago (detalhes de segurança em **C.4.1/C.4.2**):
- **`src/lib/payments/mercadopago.ts`** (novo) — wrapper: criar cobrança PIX (com `external_reference = event_signups.id`), `getPayment(id)` para reconsulta, `verifyWebhookSignature(headers, body, secret)`. Interface `PaymentGateway` para abstrair/trocar provedor depois.
- **`src/app/api/payments/webhook/route.ts`** (novo) — recebe notificação MP → (1) valida assinatura HMAC → (2) `GET /v1/payments/{id}` e confere status/valor/`external_reference` → (3) idempotente por `payment_id`; ao `approved` → `confirmEventSignupBySystem` (gera participantes).
- (Opcional) job/botão de **reconciliação** que reconsulta cobranças `pending` antigas (fallback se um webhook se perder).
- Credenciais por tenant (cifradas, **nunca no client**): `access_token` (criar/consultar cobranças) **e** `webhook secret` (validar assinatura). `public_key` só se usar Checkout Transparente.

### C.8 Arquivos afetados
- **Novo:** `event_signups` (migration, c/ campos de gateway) + `event.info` + `tournaments.start_time/level_description` (migrations).
- **Novo:** `src/app/(arena)/eventos/[id]/inscrever/page.tsx` (form nativo + tela de QR PIX).
- **Novo:** `src/lib/payments/mercadopago.ts` (wrapper) + `src/app/api/payments/webhook/route.ts` (webhook).
- **Novo:** painel admin de inscrições/pagamentos + config de credencial MP no hub do evento (`src/app/admin/eventos/[id]/...`).
- `src/app/(arena)/eventos/[id]/page.tsx` — página pública de informações + CTA.
- `src/lib/tournaments/seeding.ts` — `potsSeeding`.
- `src/lib/tournaments/types.ts` + repo — `EventSignup`, `event.info`, campos de divisão.
- `src/app/actions/tournaments.ts` — actions de inscrição/confirmação/info/cobrança.
- Variáveis/segredos do Mercado Pago por tenant. **Sem Supabase Storage / sem upload de arquivos.**

### C.9 Sub-ordem do Bloco C (faseada — pagamento por último)
Alinhado à priorização do usuário: **construir a inscrição inteira simulada antes de tocar no Mercado Pago.**

- **Fase 2 (inscrição simulada, sem terceiros):** **C4** (seed por `pot`) → **C1** (página de informações + `event.info`) → **C2** (form nativo + `event_signups`, rodando em modo `manual`/`free` com confirmação do admin). Aqui a inscrição já funciona de ponta a ponta para simular com o cliente.
- **Fase 3 (por último):** **C3** (Mercado Pago: cobrança PIX + webhook + segurança C.4.1/C.4.2). Aditivo — só habilita o modo `gateway` por cima do que já existe. É o único ponto com dependência externa.

> Vantagem: se o cliente quiser, dá para **ir a produção com inscrição em modo `manual`** (admin confirma) e ligar o pagamento automático depois, sem refazer nada.

### C.10 Decisões (✅ confirmadas com o usuário)
1. ✅ **Pagamento via gateway (Mercado Pago) + togglável por evento, SEM armazenar arquivos** — `info.payment.mode` ∈ `gateway|manual|free`. `gateway`: cobrança PIX + webhook confirmam **automaticamente**; `manual`: admin marca pago (zero upload); `free`: gratuito. **Nenhum modo usa Supabase Storage** (decisão de custo/infra). **Recebimento na conta do organizador** (credenciais MP por tenant); split fica como evolução futura.
2. ✅ **Entidade `event_signups`** adotada (inscrição-de-evento → N participantes).
3. ✅ **Página de informações estruturada + markdown** — campos típicos (prazo, contato, PIX, preços, horários por divisão, premiação) **+** bloco de descrição livre em markdown. É exatamente o `event.info` da seção C.3.
4. ✅ **Inscrição permite convidado** (sem login), com nome/e-mail/telefone como no Forms. Quando houver conta com o mesmo e-mail, casar `user_id` automaticamente (vincula ranking/ELO). Login é opcional, não obrigatório.

---

## BLOCO D — Remover vários jogadores de uma vez (item 2)

### D.1 Objetivo
Seleção múltipla na lista de inscritos + remoção em lote.

### D.2 UI (aba Inscritos do admin)
`src/app/admin/torneios/[id]/page.tsx`:
- Botão "Selecionar" alterna **modo seleção**: cada card mostra um **checkbox**.
- Cabeçalho ganha "Selecionar todos" e contador "N selecionados".
- Botão "Remover selecionados" abre `ConfirmModal` (obrigatório pelo padrão do projeto) listando quantos serão removidos.
- Manter o `X` individual no hover para remoção avulsa.

### D.3 Action
`src/app/actions/tournaments.ts`:
```ts
export async function removeParticipants(participantIds: string[], tournamentId: string) {
  await assertAdmin();
  const repo = await getTournamentRepo();
  await repo.removeParticipants(participantIds); // novo método no repo (delete in[])
  await logAdmin("tournament_remove_participants", { tournament_id: tournamentId, count: participantIds.length });
  invalidateTournament(tournamentId);
  return { ok: true };
}
```
- `repo.removeParticipants` (novo) → `delete ... where id = any($ids)`. Evita N round-trips.
- Bloquear quando `status === "active"`/`"finished"` (igual ao remove individual).

### D.4 Arquivos afetados
- `src/app/admin/torneios/[id]/page.tsx` — estado de seleção + UI checkbox + ConfirmModal.
- `src/app/actions/tournaments.ts` — `removeParticipants`.
- `src/lib/tournaments/repo/*` — método `removeParticipants`.

---

## Migrations (resumo)
| Bloco | Migration nova? |
|-------|-----------------|
| A — grupos | **Não** (lógica TS; possível ajuste em RPC de bracket sem schema novo). |
| B — desempate | **Não** (campo `sets` já existe). |
| C — inscrição | **Sim:** `event_signups` (tabela nova, c/ campos de gateway); `event.info jsonb`; `tournaments.start_time/level_description`. Mercado Pago (PIX+webhook, conta do organizador). **Sem Storage/upload.** Seed (`pot`) reusa coluna existente. |
| D — remoção | **Não** (apenas server action/repo). |

> Toda migration criada **não será aplicada em prod** pelo assistente — o usuário aplica manualmente (regra do projeto).

## Testes (Vitest)
- `group-planner.test.ts`: tabela de exemplos A.3 (8,12,20,24,30,100…).
- `standings.test.ts`: empate duplo (head-to-head), triplo (mini-tabela), razões de sets/pontos, W.O., `sets` ausente.
- `seeding.test.ts`: `potsSeeding` ordena por `pot`; sem `pot` vai ao fim; separação 1º×2º do mesmo grupo no KO.

## Critérios de aceite (resumo)
- [ ] Torneio de 100 inscritos gera ~33 grupos de 3/4, top 2 avançam, KO completa com byes.
- [ ] Torneio de 20 → 6 grupos (4,4,3,3,3,3), 12 classificados, KO de 16.
- [ ] Na fase de grupos é possível lançar o placar de cada set; no mata-mata não.
- [ ] Empates no grupo seguem ITTF: pontos → razão de sets → razão de pontos, só entre empatados.
- [ ] Inscrição captura pontuação e os seeds saem ordenados automaticamente por ela.
- [ ] Admin seleciona vários inscritos e remove todos de uma vez, com confirmação.

## Pendências antes de codar
- ✅ Decisões do Bloco C resolvidas (ver C.10): pagamento togglável, `event_signups`, info estruturada+markdown, convidado permitido.
- 🔎 **Único checkpoint restante (A/B):** confirmar onde a classificação e o emparelhamento grupo→KO são calculados (TS `computeGroupStandings`/`seeding.ts` vs RPC SQL em `supabase-repo.ts`). O desempate ITTF e a separação 1º×2º precisam entrar onde a ordenação realmente acontece. Verifico no início do Bloco A.

> **Escopo:** o Bloco C cresceu de "campos no form" para "substituir o Google Forms" (inscrição de evento + pagamento + página de informações). É o maior dos 4 blocos. Sugiro tratá-lo por último e na sub-ordem C.9, podendo entregar C4/C1 cedo e deixar C2/C3 (pagamento) como fase final.
