## ADDED Requirements

### Requirement: Pontuação e ordenação primária de grupo
O sistema SHALL pontuar os jogos de grupo por pontos de vitória (**3 pontos por vitória, 0 por derrota**) e ordenar a classificação primariamente por pontos de vitória (desc), antes de qualquer critério de desempate. A pontuação oficial 2/1/0 (que distingue derrota disputada de W.O.) é um follow-up **não ativo**: os dados de partida não marcam W.O., e em grupo completo sem W.O. a ordem por 2/1/0 é equivalente à ordem por 3/vitória.

#### Scenario: Vitória pontua, derrota não
- **WHEN** um jogador vence uma partida e perde outra
- **THEN** ele soma 3 (vitória) + 0 (derrota) = 3 pontos

#### Scenario: Ordem por pontos de vitória
- **WHEN** os jogadores de um grupo têm quantidades diferentes de vitórias
- **THEN** a classificação primária os ordena por pontos de vitória (desc), com o desempate aplicado apenas entre quem empata em pontos

### Requirement: Captura de placar set-a-set nos jogos de grupo
Nos jogos de **grupo**, o sistema SHALL capturar e armazenar o placar de **cada set** em `tournament_matches.sets` (`Array<[pontosA, pontosB]>`), com uma linha por set decidido (`nº de sets = scoreA + scoreB`). O mata-mata SHALL NOT exigir placar por set (comportamento inalterado).

#### Scenario: Placar por set gravado num jogo de grupo
- **WHEN** o admin lança um jogo de grupo 2–1 informando os pontos de cada set
- **THEN** `sets` é gravado com 3 pares (ex.: `[[11,7],[9,11],[11,8]]`) e o vencedor de cada set coincide com o placar agregado

#### Scenario: Validação por set
- **WHEN** um set informado tem vencedor com menos de 11 pontos ou diferença menor que 2
- **THEN** o sistema SHALL rejeitar o lançamento com erro de validação

#### Scenario: Mata-mata não captura sets
- **WHEN** o admin lança um jogo de mata-mata
- **THEN** nenhum input de placar por set é exigido e o comportamento atual é mantido

### Requirement: Desempate progressivo ITTF/CBTM entre empatados
Havendo empate de **pontos de vitória** entre 2 ou mais jogadores, o sistema SHALL desempatar considerando **apenas as partidas entre os jogadores empatados**, aplicando em ordem: (1) pontos de vitória na mini-tabela, (2) **razão de sets** (sets ganhos ÷ perdidos), (3) **razão de pontos de game** (pontos ganhos ÷ perdidos). A aplicação SHALL ser **progressiva**: assim que um subconjunto se distingue, ele é fixado na classificação e o critério recomeça entre os que permanecem empatados.

#### Scenario: Empate duplo resolvido pelo confronto direto
- **WHEN** dois jogadores empatam em pontos e um venceu o confronto direto
- **THEN** o vencedor do confronto direto fica à frente (critério 1 na mini-tabela)

#### Scenario: Empate triplo resolvido por razão de sets
- **WHEN** três jogadores empatam em pontos e também nos pontos de vitória entre si
- **THEN** eles são ordenados pela razão de sets calculada **somente** nos jogos entre os três

#### Scenario: Aplicação progressiva
- **WHEN** num empate triplo a razão de sets distingue apenas o 1º colocado, restando dois ainda iguais
- **THEN** o 1º é fixado e o desempate recomeça entre os dois restantes (reavaliando os critérios só entre eles)

#### Scenario: Razão de pontos como terceiro critério
- **WHEN** dois jogadores seguem empatados após pontos e razão de sets
- **THEN** a ordem é definida pela razão de pontos de game entre eles

### Requirement: Robustez a dados ausentes e paridade da decisão
O cálculo SHALL ser robusto a partidas sem placar detalhado e SHALL produzir a **mesma ordenação** onde quer que a classificação seja consumida (exibição e definição dos classificados que avançam ao mata-mata).

#### Scenario: Jogo sem placar por set não quebra o cálculo
- **WHEN** uma partida entre empatados não tem `sets` preenchido (jogo antigo ou W.O.)
- **THEN** sua contribuição para a razão de pontos é neutra (0) e o desempate não falha

#### Scenario: Razão com denominador zero
- **WHEN** um jogador tem sets/pontos perdidos igual a zero
- **THEN** a razão SHALL ser tratada como infinita se houver ganhos e como 0 se não houver ganhos

#### Scenario: Classificados coerentes com a exibição
- **WHEN** a fase de grupos termina e os classificados são promovidos ao mata-mata
- **THEN** os promovidos SHALL ser exatamente os top 2 da classificação exibida (mesmo desempate aplicado)
