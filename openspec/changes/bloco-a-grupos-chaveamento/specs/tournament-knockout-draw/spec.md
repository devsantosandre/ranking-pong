## ADDED Requirements

### Requirement: Posicionamento dos classificados no mata-mata (ITTF 3.7)
O sistema SHALL posicionar os classificados dos grupos no mata-mata seguindo o Second Stage Draw da ITTF (3.7): os **vencedores de grupo** assumem as posições de cabeça de chave na ordem do grupo (vencedor do grupo 1 → topo, grupo 2 → fundo, grupos 3–4 em metades opostas, e assim por diante), e cada **2º colocado** SHALL ficar na **metade oposta** ao vencedor do seu próprio grupo. A regra de 1º e 2º do mesmo grupo em metades opostas SHALL ter precedência sobre a separação por associação. Isso SHALL ser implementado por `seedQualifiersIntoBracket` reutilizando `buildStandardOrder`.

#### Scenario: Vencedores de grupo nas posições de seed
- **WHEN** há 4 grupos e os classificados são montados no bracket
- **THEN** o vencedor do grupo 1 ocupa a posição do topo e o vencedor do grupo 2 ocupa a posição do fundo

#### Scenario: 1º e 2º do mesmo grupo em metades opostas
- **WHEN** o vencedor e o 2º colocado de um mesmo grupo são posicionados
- **THEN** eles ficam em metades opostas do bracket e só poderiam se reencontrar na final

#### Scenario: Precedência sobre separação por associação
- **WHEN** manter 1º e 2º do mesmo grupo em metades opostas conflita com separar jogadores do mesmo clube
- **THEN** a regra das metades opostas prevalece

### Requirement: Distribuição de byes nos melhores seeds (ITTF)
Quando o número de classificados `Q = 2 × g` não for potência de 2, o sistema SHALL montar um bracket de tamanho `B = nextPowerOfTwo(Q)` e distribuir `B − Q` **byes** o mais uniformemente possível, alocando-os primeiro aos **melhores seeds**, em ordem de seed.

#### Scenario: 20 jogadores, 12 classificados, 4 byes
- **WHEN** 20 jogadores formam 6 grupos (12 classificados) e o mata-mata é montado
- **THEN** o bracket tem 16 posições e os 4 byes vão para os seeds 1, 2, 3 e 4 (os 4 melhores vencedores avançam direto à 2ª rodada)

#### Scenario: Um único bye vai ao seed 1
- **WHEN** o número de classificados deixa exatamente 1 bye
- **THEN** o bye é alocado ao seed 1

#### Scenario: Classificados em potência de 2 não geram bye
- **WHEN** `Q` já é potência de 2 (ex.: 8 ou 16 classificados)
- **THEN** o bracket não tem byes
