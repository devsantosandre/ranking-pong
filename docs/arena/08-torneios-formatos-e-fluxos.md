# 08 — Torneios: Formatos, Algoritmos & Fluxos

## 1. Formatos (motor único, render único)
| Formato | Fase | Descrição |
|---|---|---|
| Eliminatória simples (+3º lugar) | MVP | árvore, vencedor avança |
| Rei da mesa | MVP | desafiante × rei, reinos consecutivos |
| Round-robin | F2 | todos × todos, tabela |
| Grupos + mata-mata | **F2 (prioritário)** | grupos → top N → bracket |
| Scorecard | F2 | pontos corridos + leaderboard |
| Americano | F3 | duplas, parceiro rotativo, pontuação individual |
| Suíço | F4 | pareamento por pontuação |
| Dupla eliminação | F4 | winners + losers |
| Liga (promoção/rebaixamento) | F4 | ligado às divisões |

## 2. Algoritmo de layout do bracket (`lib/tournaments/bracket-layout.ts`)
```
entrada: matches[] (round, slot, nextMatchId)
const: CARD_W=270, CARD_H=84, ROW_GAP=24, COL_GAP=120

0. FILTRAR: matches.filter(m => m.bracket !== "group")   // grupos têm round=100
1. agrupar por round (maior nº de jogos = round inicial = maxRound)
2. round inicial: empilhar; y[i] = i*(CARD_H + baseGap)
3. para r = maxRound-1 .. 1:
     para cada match m: achar filhos f1,f2 (nextMatchId==m.id)
     y[m] = (y[f1]+y[f2])/2           // centraliza no par
4. x[r] = (maxRound - r)*(CARD_W + COL_GAP)
5. retornar PositionedMatch[]{x,y,height}

conectores: para cada match com nextMatchId:
  origem=(x+CARD_W, y+CARD_H/2); destino=(x_next, y_next+CARD_H/2)
  midX=(origem.x+destino.x)/2
  path = M origem → H midX → V destino.y → H destino.x   (ortogonal)
```

**Convenção de round (IMPORTANTE):** `round=1` = Final; quanto maior o número, mais cedo no torneio.
```
RoundHeader: fromFinal = round - 1
  fromFinal=0 → "Final"
  fromFinal=1 → "Semifinal"
  fromFinal=2 → "Quartas de Final"
  fromFinal=3 → "Oitavas de Final"
```
Partidas de grupo usam `round=100` e `bracket="group"` — **devem ser filtradas** em `computeBracketLayout` e em `BracketCanvas` (rounds useMemo).

- **memoizar** com `useMemo` no componente.
- **BYE**: match com 1 participante já tem winner e propaga na geração.

## 3. Seeding (`lib/tournaments/seeding.ts`)
```
standard(n):  espelhamento clássico (1, n, n/2+1, …) → melhor × pior
pots(parts):  agrupa por força em P potes; sorteia 1 de cada pote por grupo
sequential:   ordem de entrada
manual:       ordem do SeedingBoard (dnd-kit) → persiste em seed
elo(parts):   ordena por rating do ranking geral, depois standard
fairness:     pós-processa para evitar mesma divisão/professor na rodada 1 (swap)
```

## 4. Grupos: desempate (configurável)
Ordem padrão: **pontos → saldo de sets → confronto direto → sorteio**. Configurável por torneio. `close_group_stage` aplica e semeia o mata-mata (cruzamento A1×B2, B1×A2, …).

## 5. Win probability (`lib/tournaments/win-probability.ts`)
```
P(A vence) = 1 / (1 + 10^((Rb - Ra)/400))   // Ra,Rb = ratings ELO do ranking geral
```
Usado na `WinProbabilityBar` e na detecção de **zebra** (resultado contra a probabilidade).

## 6. Fluxo admin — grupos + mata-mata (passo a passo)
1. **Criar** torneio (nome, formato, best-of, seeding, modo de inscrição).
2. **Participantes**: `AddParticipantsPanel` — modo único (nome) ou bulk (textarea, 1 por linha). Sem seletor de bandeira/país.
3. **Seeding**: `SeedingBoard` (dnd-kit) na aba "Seeding".
4. **Grupos/aba "Grupos"**: tabela de classificação por grupo + cards de partidas + botão "Encerrar fase de grupos" (ConfirmModal).
5. `generateBracket` → cria grupos. Jogar grupos via `ScoreSheet` na aba Placar ou inline no bracket.
6. `closeGroupStage` (confirm) → semeia mata-mata. Jogar até a final.
7. `finishTournament` → **coroação** + notícia no feed + conquista.

**Aba Chave (admin):** exibe `BracketCanvas` inline com scroll horizontal; click em partida pendente abre ScoreSheet modal. Link "Abrir em tela cheia" aponta para `/torneios/[id]/chave`.

## 7. Fluxo jogador
Lista `/torneios` → bracket ao vivo `/torneios/[id]/chave` (realtime, **read-only** se não for admin) → standings de grupos → "é a sua vez" via push → (F2) **lançar placar pelo QR** no fluxo de confirmação.

## 8. Edge cases (tratar explicitamente)
- Participantes **não potência-de-2** → **BYEs** automáticos.
- Participante **removido após chave gerada** → bloquear ou recriar (confirm).
- **Empate em grupo** → critério de desempate configurável.
- **Resultado errado** → `revertResult` recursivo (`ConfirmModal` + log `admin_logs`).
- **W/O / no-show** → propaga vencedor; badge específico.
- **Conexão cai** no lançamento → `match-sync-queue` (offline-first).
- **Dois admins** simultâneos → realtime + last-write-wins com aviso.
- **Número ímpar no Americano/round-robin** → rodada de "bye" rotativo.

## 9. Componentes-herói (contratos)
```ts
<BracketCanvas matches participants live? onMatchClick? />
<MatchCard match a b status onClick? showProbability? />
<ParticipantRow seed flag name score variant="win"|"lose"|"pending"|"tbd"|"walkover" />
<RoundHeader title deadlineAt? statusPill? />
<StatusPill kind="active"|"scheduled"|"played"|"noshow"|"tbd"|"win"|"wo" label />
<WinProbabilityBar pA />
<UpsetBadge />
<SeedingBoard participants onChange />
<ScoreSheet match bestOf onSubmit />
<StandingsTable rows />
<TvBracket tournamentId mode />
```
Todos: tokens Arena, três estados (loading/vazio/erro), `tabular-nums`, estado por cor **+ ícone**.

## 10. Reuso de fluxo de campeão
`finishTournament` reusa o padrão já testado das **temporadas**: celebração visual, conquista, notícia automática no feed. Não reinventar.
