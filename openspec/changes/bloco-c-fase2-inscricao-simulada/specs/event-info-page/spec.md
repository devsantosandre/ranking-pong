## ADDED Requirements

### Requirement: Informações do evento (blob editável)
Cada evento SHALL ter um bloco de informações opcional (`event.info`) contendo, todos opcionais: descrição em markdown, prazo de inscrição, contato, preços por número de divisões, modo de pagamento, premiação e texto de regras. O admin SHALL poder editar esse bloco. A validação SHALL garantir que apenas campos conhecidos sejam gravados (sem lixo arbitrário).

#### Scenario: Admin edita as informações do evento
- **WHEN** o admin salva descrição, prazo e preços no editor de informações
- **THEN** o `event.info` é persistido e passa a aparecer na página pública do evento

#### Scenario: Evento sem informações
- **WHEN** um evento não tem `info` preenchido
- **THEN** a página pública ainda renderiza (sem quebrar), mostrando apenas o que existe

### Requirement: Horário e nível por divisão
Cada divisão SHALL poder ter um **horário de início** (texto, ex.: "10h20") e uma **descrição de nível** (ex.: "iniciante"). Esses dados SHALL aparecer na grade de divisões da página pública do evento.

#### Scenario: Grade de horários por divisão
- **WHEN** as divisões A e E têm horários e níveis definidos
- **THEN** a página pública lista cada divisão com seu horário e nível

### Requirement: Página pública com CTA de inscrição
A página pública do evento SHALL renderizar as informações (descrição em markdown de forma segura, sem HTML não sanitizado), a grade de divisões, premiação, prazo, contato e informações de pagamento, além de um **CTA "Inscrever-se"** que leva ao formulário nativo.

#### Scenario: Markdown seguro
- **WHEN** a descrição contém markdown
- **THEN** ela é renderizada como markdown com HTML escapado (sem injeção de HTML cru)

#### Scenario: CTA leva ao formulário
- **WHEN** o visitante aciona "Inscrever-se"
- **THEN** é levado ao formulário nativo de inscrição do evento
