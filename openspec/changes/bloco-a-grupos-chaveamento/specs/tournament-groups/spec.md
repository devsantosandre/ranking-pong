## ADDED Requirements

### Requirement: Dimensionamento de grupos (2/3/4, preferência 3)
O sistema SHALL dimensionar os grupos via `planGroupSizes(n)`, preferindo grupos de **3**, aceitando **2 e 4**, e SHALL escolher o número de grupos que maximize grupos de 3 dentro da faixa válida (`ceil(n/4) .. floor(n/3)`), permitindo um grupo de 2 apenas quando não houver divisão só com 3 e 4. Os **2 primeiros** de cada grupo SHALL avançar para o mata-mata.

#### Scenario: Campos divisíveis e grandes
- **WHEN** `planGroupSizes` recebe 8, 12, 24, 30 e 100
- **THEN** retorna respectivamente `[4,4]`, `[3,3,3,3]`, `[3,3,3,3,3,3,3,3]`, `[3,3,3,3,3,3,3,3,3,3]` e `[4, 3×32]` (1 grupo de 4 e 32 de 3)

#### Scenario: Evitar grupos de 2 desnecessários
- **WHEN** `planGroupSizes(20)` é chamado
- **THEN** retorna `[4,4,3,3,3,3]` (6 grupos), sem nenhum grupo de 2

#### Scenario: Campo pequeno que exige um grupo de 2
- **WHEN** `planGroupSizes(5)` é chamado
- **THEN** retorna tamanhos em `{2,3}` somando 5 (ex.: `[3,2]`), pois não há divisão só com 3 e 4

#### Scenario: Top 2 avançam define os classificados
- **WHEN** há `g` grupos
- **THEN** o número de classificados para o mata-mata SHALL ser `2 × g`

### Requirement: Semeadura snake (ITTF 3.6) com separação por associação
O sistema SHALL distribuir os jogadores nos grupos pelo sistema **snake/serpentina** (ITTF 3.6.1): o mais forte no 1º grupo, o 2º no 2º grupo, … e então serpenteando de volta, de modo que cada grupo receba exatamente um dos jogadores mais fortes antes do próximo nível. A distribuição padrão SHALL ser **determinística** (ordem de força). Jogadores da mesma **associação/clube** SHOULD ser separados em grupos diferentes como critério secundário, sem violar regras de maior precedência.

#### Scenario: Um jogador forte por grupo (snake)
- **WHEN** 24 jogadores ordenados por força são distribuídos em 8 grupos
- **THEN** os seeds 1–8 ocupam grupos distintos (A–H) e os seeds 9–16 voltam na ordem inversa (H–A)

#### Scenario: Determinismo
- **WHEN** a mesma lista ordenada é distribuída duas vezes sem sorteio
- **THEN** a composição dos grupos é idêntica nas duas execuções

#### Scenario: Separação por clube quando possível
- **WHEN** dois jogadores do mesmo clube seriam alocados no mesmo grupo e há grupo alternativo elegível
- **THEN** o segundo jogador SHALL ser movido para outro grupo, preservando o balanceamento

### Requirement: UI de configuração de grupos sem trava de 8 nem de potência de 2
A `GroupsTab` SHALL permitir qualquer número de grupos suportado por `planGroupSizes(n)` (sem o teto fixo de 8) e SHALL NOT bloquear a configuração quando o número de classificados não for potência de 2 (os byes completam o mata-mata). A UI SHALL pré-selecionar `planGroupSizes(n)` e exibir um resumo da configuração, mantendo o `GroupDistributionBoard` para ajuste manual.

#### Scenario: Sem teto de 8 grupos
- **WHEN** o admin abre a configuração de grupos com 100 confirmados
- **THEN** a opção de ~33 grupos está disponível e selecionável

#### Scenario: Classificados fora de potência de 2 não bloqueiam
- **WHEN** a configuração resultaria em 12 classificados (não potência de 2)
- **THEN** a UI permite confirmar e indica que o mata-mata será completado com byes

#### Scenario: Resumo da configuração
- **WHEN** 20 confirmados e a sugestão padrão é aplicada
- **THEN** a UI exibe um resumo no formato "6 grupos · 4 de 3 e 2 de 4 · 12 classificados → mata-mata de 16 (4 byes)"
