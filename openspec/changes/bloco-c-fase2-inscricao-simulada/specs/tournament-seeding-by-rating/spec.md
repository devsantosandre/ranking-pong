## ADDED Requirements

### Requirement: Semeadura por pontuação/rating (pots)
O sistema SHALL oferecer uma semeadura que ordena os participantes por **pontuação (`pot`) decrescente** e então aplica a distribuição padrão de chave. Participantes **sem** pontuação SHALL ir para o fim da fila (mais fracos). Essa semeadura SHALL ser usada quando a geração de chave/tabela roda com o método `pots`.

#### Scenario: Ordenação por pot decrescente
- **WHEN** os participantes têm `pot` 1800, 1500 e 2000
- **THEN** a ordem de seed resultante é 2000, 1800, 1500 (do maior pot para o menor)

#### Scenario: Sem pontuação vai ao fim
- **WHEN** um participante não tem `pot` definido (null)
- **THEN** ele é semeado depois de todos os que têm `pot`, na cauda da chave

#### Scenario: Método pots liga a semeadura
- **WHEN** a chave é gerada com `seedingMethod === "pots"`
- **THEN** a ordem dos jogadores segue `potsSeeding` (por `pot` desc), permitindo ajuste manual posterior na aba Seeds
