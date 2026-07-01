# tournament-participant-removal

## Purpose
Remoção de inscritos pelo admin na aba Inscritos: seleção múltipla e remoção em lote (com confirmação), além da remoção individual, respeitando a trava de estado do torneio.

## Requirements

### Requirement: Seleção múltipla de inscritos
Na aba Inscritos do admin, o sistema SHALL oferecer um **modo de seleção** que permite marcar vários inscritos ao mesmo tempo, sem removê-los ainda. O modo SHALL expor "Selecionar todos" e um contador de quantos estão selecionados, e SHALL preservar a remoção individual (o `X` no hover) fora do modo seleção.

#### Scenario: Entrar no modo seleção
- **WHEN** o admin aciona "Selecionar" na aba Inscritos
- **THEN** cada card de inscrito exibe um checkbox e o cabeçalho mostra "Selecionar todos" e o contador "0 selecionados"

#### Scenario: Selecionar todos e contar
- **WHEN** o admin marca "Selecionar todos" num torneio com N inscritos
- **THEN** os N inscritos ficam marcados e o contador mostra "N selecionados"

#### Scenario: Sair do modo limpa a seleção
- **WHEN** o admin desliga o modo seleção
- **THEN** nenhum inscrito permanece marcado e o `X` de remoção individual volta a ficar disponível

### Requirement: Remoção em lote com confirmação
O sistema SHALL permitir remover **todos os inscritos selecionados de uma vez**, exigindo confirmação prévia num `ConfirmModal` que informa a quantidade a remover. A remoção SHALL usar uma única operação em lote no repositório (não uma chamada por inscrito).

#### Scenario: Confirmar remoção em lote
- **WHEN** o admin tem K inscritos selecionados e aciona "Remover selecionados"
- **THEN** um `ConfirmModal` aparece informando que K inscritos serão removidos e, ao confirmar, os K são removidos numa única operação e a seleção é limpa

#### Scenario: Cancelar não remove
- **WHEN** o admin aciona "Remover selecionados" e cancela o `ConfirmModal`
- **THEN** nenhum inscrito é removido e a seleção é mantida

#### Scenario: IDs inexistentes não quebram
- **WHEN** a lista de remoção inclui um id que já não existe
- **THEN** os demais são removidos normalmente e a operação não falha

### Requirement: Trava por estado do torneio
O sistema SHALL bloquear a **remoção em lote** de inscritos quando o torneio estiver com status `active` ou `finished`, rejeitando na camada de repositório/server independentemente da UI. Na UI, o modo seleção e a remoção individual SHALL ficar indisponíveis nesses estados (o `X` individual já é ocultado quando `active`/`finished`).

#### Scenario: Remoção em lote bloqueada em torneio ativo
- **WHEN** uma remoção em lote é solicitada para um torneio com status `active` ou `finished`
- **THEN** a operação rejeita com erro e nenhum inscrito é removido

#### Scenario: Remoção permitida antes do início
- **WHEN** o torneio está em `draft` ou `registration`
- **THEN** a remoção em lote é permitida

#### Scenario: Modo seleção indisponível em torneio ativo
- **WHEN** o torneio está `active` ou `finished`
- **THEN** o botão "Selecionar"/modo seleção não fica disponível na aba Inscritos
