# Estudo — Distribuição de Grupos e Chaveamento (ITTF & CBTM)

> **Status:** 📋 Estudo de referência (fonte para o **Bloco A** de `PLANO_TORNEIOS_GRUPOS_E_INSCRICAO.md`).
> **Objetivo:** definir, com fidelidade às regras oficiais, **como os jogadores são distribuídos nos grupos** e **como os classificados dos grupos alimentam o mata-mata (chaveamento)**.
> **Não cobre:** critérios de classificação/desempate dentro do grupo (ver Bloco B do plano).

## Fontes oficiais consultadas
- **ITTF — Extract from Handbook for Tournament Referees**, seções **3.6 (Seeding of Groups)** e **3.7 (Second Stage Draw)** + regras de bye (página "Paralympics/Teams Draw"). Texto reproduzido verbatim abaixo. ([PDF IPTTC](https://www.ipttc.org/communication/2016/Rio/Draw%20rules.pdf))
- **CBTM / CBTM-Web** — semeadura por **rating**, separação por delegação, grupos de **3–4**, **top 2** avançam. (Regulamentos técnicos que usam o sistema CBTM-Web, ex.: [Jogos da Juventude / CBDE](https://www.cbde.org.br/wp-content/uploads/2021/08/Regulamento%20Espec%C3%ADfico%20-%20T%C3%AAnis%20de%20Mesa-1.pdf), [CBTM](https://www.cbtm.org.br/).)
- Sistema de jogo geral (pontos de partida 2/1/0): [allabouttabletennis](https://www.allabouttabletennis.com/competition-and-tournament-systems-of-play.html).

---

## PARTE 1 — Distribuição dos jogadores nos grupos (semeadura)

### 1.1 Sistema "snake" (serpentina) — ITTF 3.6.1
A semeadura padrão distribui o **mais forte em cada grupo**, depois "serpenteia" de volta:

> *"the highest ranked entry is placed in the 1st group, the 2nd in the 2nd group … until there is one in each group. … the next highest-ranked entries are similarly placed … starting this time with the last group and ending at the first. The process continues … so that they form a continuous 'snake' in ranking order."* — ITTF 3.6.1

**Figura 3.16 — snake básico, 32 jogadores em 8 grupos:**
```
         A    B    C    D    E    F    G    H
         1    2    3    4    5    6    7    8     →
        16   15   14   13   12   11   10    9     ←
        17   18   19   20   21   22   23   24     →
        32   31   30   29   28   27   26   25     ←
```
Cada coluna é um grupo; a numeração é a **ordem de força** (1 = mais forte). É exatamente o que a UI atual já faz em `computePreview` (`GroupsTab`).

### 1.2 Snake modificado (com aleatoriedade) — ITTF 3.6.2
O snake puro é **100% previsível** a partir do ranking. O ITTF recomenda introduzir aleatoriedade **depois** de fixar 1 jogador por grupo: sortear os demais **em pequenos lotes, em ordem de ranking**, garantindo só que jogadores **da mesma associação caiam em grupos diferentes**.

> *"After one entry has been placed in each group the others should be drawn, a few at a time in ranking order … making sure only that players from the same Association are drawn into different groups."* — ITTF 3.6.2

**Figura 3.17 — snake modificado:**
```
         A    B    C    D    E    F    G    H
         1    2    3    4    5    6    7    8
        (13,  14,  15,  16) (9,   10,  11,  12)    ← lote sorteado entre A–D / E–H
        (17,  18,  19,  20) (21,  22,  23,  24)
        (29,  30,  31,  32) (25,  26,  27,  28)
```
Os ranqueados 9–12 são sorteados **entre os grupos E–H**, os 13–16 **entre A–D**, e assim por diante.

### 1.3 Tamanho do lote por número de grupos — ITTF
Regra prática do Handbook (página de sorteio) para "draw a few at a time":

| Nº de grupos | Sortear por vez |
|---|---|
| 2 | 2 |
| 4 | 2 |
| 5 | 2, depois 3 |
| 6 | 3 |
| 8 | 4 |

Generalizando: **o lote ≈ metade do nº de grupos** (cada "fileira" da serpentina é sorteada em duas metades, espelhando o vai-e-vem do snake).

### 1.4 Especificidades CBTM
- **Cabeça de grupo por rating:** maior rating CBTM → posição 1, segundo maior → posição 2, etc. (No nosso app: `pot` = rating informado na inscrição → `potsSeeding`.)
- **Empate de rating:** o sistema **CBTM-Web sorteia** as posições entre os empatados.
- **Separação por delegação/clube:** *"atletas da mesma delegação não podem ficar no mesmo grupo"* — se o rating colocaria dois juntos, o segundo vai para a **posição do grupo seguinte**. (No nosso app: usar o campo **`club`** do `event_signups` como "associação".)
- **Tamanho:** grupos de **mín. 3 / máx. 4**; **os 2 primeiros** de cada grupo avançam para a eliminatória simples.

> **Convergência ITTF × CBTM:** ambos usam snake por ranking + separação por associação/delegação + top 2 avançam. A CBTM apenas fixa o tamanho 3–4 e a fonte de ranking (rating CBTM). É o que adotamos.

---

## PARTE 2 — Número e tamanho dos grupos
(Detalhado no **Bloco A** do plano via `planGroupSizes(n)`.)
- **Preferência 3**, aceitando **2 e 4** (CBTM: 3–4; permitimos 2 para campos pequenos/incompletos).
- **Top 2** por grupo avançam → `Q = 2 × nº de grupos` classificados.
- Exemplos: 20→6 grupos (4,4,3,3,3,3); 24→8 grupos de 3; 100→33 grupos (1×4 + 32×3).

---

## PARTE 3 — Classificados → chaveamento (Second Stage Draw, ITTF 3.7)

### 3.1 Regra mestra — 1º e 2º do mesmo grupo em metades opostas (3.7.1)
> *"the 1st and 2nd placed players in a group must be in opposite halves. This takes precedence over separation by Association."* — ITTF 3.7.1

### 3.2 Posicionamento dos vencedores de grupo (3.7.2)
Os **vencedores** assumem as posições de cabeça de chave, **na ordem do grupo**:
- Vencedor do **Grupo 1 → posição do topo** (seed 1);
- Vencedor do **Grupo 2 → posição de baixo** (seed 2);
- Vencedores dos **Grupos 3 e 4** → sorteados entre o **fundo da metade de cima** e o **topo da metade de baixo** (posições de seed 3–4), respeitando separação por associação;
- Vencedores dos **Grupos 5–8** → sorteados no topo/fundo de cada **quarto** ainda livre;
- E assim por diante (9–16 → oitavos), até todos os vencedores estarem posicionados.

### 3.3 Posicionamento dos 2º colocados
> *"Second placed players in group are drawn at random into the opposite half to their group winner (this takes precedence over Association separation)."* — ITTF 3.7.2

Cada **2º colocado** é sorteado **aleatoriamente na metade oposta** à do vencedor do seu grupo. Por fim, **separar por associação** o quanto for possível.

### 3.4 Tradução para o nosso modelo
O nº de grupos `g` define `Q = 2g` classificados. O bracket tem tamanho `B = nextPowerOfTwo(Q)`.
1. Ordenar grupos por desempenho na fase de grupos (ou pelo seed do cabeça).
2. **Vencedores** recebem os números de seed `1..g` e são posicionados com a ordem-padrão do bracket (`buildStandardOrder(B)`), que já entrega 1→topo, 2→fundo, 3–4 em metades opostas, etc.
3. **2º colocados** recebem `g+1..2g` e vão para a **metade oposta** ao respectivo 1º (garantido por construção: parear o 2º do grupo *k* com o vencedor de um grupo da outra metade).
4. Aplicar **separação por clube** como critério secundário quando houver liberdade de sorteio.

---

## PARTE 4 — Distribuição de byes (quando Q não é potência de 2)

Quando `Q` (classificados) **não** é potência de 2, o bracket de tamanho `B = nextPowerOfTwo(Q)` tem `B − Q` **byes**. Regra oficial:

> *"Byes are distributed as evenly as possible throughout the first round, being placed first against seeded places, in seeding order."* — ITTF (Draw rules)

Ordem de quem recebe bye (grupos de seed equivalentes 1, 2, 3=, 5=, 9=):
- **1 bye** → seed 1;
- **2 byes** → seeds 1 e 2;
- **3 byes** → seeds 1, 2 e (3 **ou** 4 — tratados como iguais);
- **4 byes** → seeds 1–4;
- **5–7 byes** → seeds 1–4 + quaisquer dos seeds 5–8;
- e assim por diante.

Ou seja: **os melhores primeiros-colocados folgam na 1ª rodada**, distribuídos uniformemente. A função `buildStandardOrder` já posiciona os BYEs nos seeds altos (a numeração espelhada faz o BYE cair contra os seeds de topo) — alinhado à regra.

**Exemplo — 20 jogadores:** 6 grupos (4,4,3,3,3,3) → `Q = 12` classificados → `B = 16` → **4 byes** → vão para os **seeds 1–4** (os 4 melhores vencedores de grupo passam direto à 2ª rodada).

---

## PARTE 5 — Mapeamento no código (Bloco A)

| Conceito ITTF/CBTM | Onde implementar | Observação |
|---|---|---|
| Tamanho/nº de grupos (pref. 3, top 2) | `src/lib/tournaments/group-planner.ts` → `planGroupSizes(n)` | já especificado no plano |
| Snake (semeadura nos grupos) | `GroupsTab.computePreview` / helper `snakeDistribute` | hoje já faz snake puro |
| Snake modificado (aleatoriedade + assoc.) | opção de "sortear" com semente reproduzível | default determinístico |
| Separação por associação | usar `club` (de `event_signups`) | secundário ao 1º/2º em metades opostas |
| Classificados → KO (3.7) | `seeding.ts` → `seedQualifiersIntoBracket` | G1→topo, G2→fundo; 1º/2º metades opostas |
| Byes | `buildStandardOrder` + `countByes` | já posiciona bye nos seeds altos |
| Fonte de ranking | `pot` = rating CBTM | `potsSeeding` (Bloco C) |

### 5.1 Recomendações de produto
1. **Default determinístico (snake puro):** previsível e auditável; melhor para torneios amadores e para o cliente entender. Botão **"Sortear (oficial ITTF)"** opcional aplica o snake modificado (3.6.2) com semente reproduzível.
2. **Separação por clube** aplicada quando houver o dado e sem violar a regra 1º/2º em metades opostas (que tem precedência).
3. **Top 2 avançam** fixo (CBTM); KO sempre completo via byes (Parte 4).
4. **Ajuste manual sempre disponível** no `GroupDistributionBoard` (arrastar) — o organizador é a autoridade final.

---

## APÊNDICE — Ordem das partidas dentro do grupo (agendamento)
> ⚠️ **A confirmar no Handbook ITTF (reg. 3.7.3) antes de implementar o agendamento.** É detalhe de **ordem de jogo**, não de distribuição/chaveamento — não afeta a classificação.

Princípio ITTF: a ordem é **fixa e predefinida**, pensada para que nenhum jogador dispute duas partidas seguidas e a partida decisiva tenda a ser a última. Ordens comumente publicadas (validar antes de codar):
- **Grupo de 3** (jogadores 1,2,3): `1–2`, `3–1`, `2–3`.
- **Grupo de 4** (1,2,3,4): `1–4`, `2–3`, `1–3`, `2–4`, `4–3`, `1–2`.

Para o nosso app, no MVP, gerar o round-robin completo do grupo (todas as combinações) já é suficiente; a ordem oficial pode ser aplicada depois como refinamento de agendamento por mesa.

---

## Resumo executivo
1. **Distribuição:** snake por ranking (1 forte por grupo, serpenteando), com separação por associação/clube — ITTF 3.6 / CBTM. Default determinístico no app, sorteio oficial opcional.
2. **Tamanho:** grupos de 3–4 (pref. 3), top 2 avançam — CBTM.
3. **Chaveamento:** vencedores assumem seeds (G1 topo, G2 fundo, …); 2º colocados na metade oposta ao seu 1º; separação por associação por último — ITTF 3.7.
4. **Byes:** uniformes, contra os melhores seeds primeiro — ITTF.
5. **Tudo já encaixa** nas funções planejadas no Bloco A (`planGroupSizes`, `buildStandardOrder`, `seedQualifiersIntoBracket`) + `GroupDistributionBoard` para ajuste manual.
