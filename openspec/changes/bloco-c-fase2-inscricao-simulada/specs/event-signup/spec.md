## ADDED Requirements

### Requirement: Formulário nativo de inscrição de evento
O sistema SHALL oferecer um formulário público de inscrição **por evento** com os campos: nome completo (obrigatório), e-mail, telefone, clube, filiação/rating CBTM, **escolha de até 2 divisões** (obrigatório ≥1), concordância com as regras (obrigatória) e observação. A inscrição SHALL permitir **convidado** (sem login).

#### Scenario: Inscrição válida
- **WHEN** um atleta preenche nome, escolhe 1 ou 2 divisões e concorda com as regras
- **THEN** a inscrição é aceita e registrada como `event_signups`

#### Scenario: Máximo de 2 divisões
- **WHEN** o atleta tenta escolher mais de 2 divisões
- **THEN** a inscrição é rejeitada com erro de validação (máximo 2)

#### Scenario: Concordância obrigatória
- **WHEN** o atleta não marca a concordância com as regras
- **THEN** a inscrição é rejeitada com erro de validação

#### Scenario: Pelo menos uma divisão
- **WHEN** o atleta não escolhe nenhuma divisão
- **THEN** a inscrição é rejeitada com erro de validação

### Requirement: Modelo de inscrição gera participações ao confirmar
Uma inscrição (`event_signups`) SHALL representar uma pessoa por evento e, ao ser **confirmada**, SHALL gerar **uma participação (`tournament_participant`) por divisão escolhida**, com `guest_name = full_name` e `pot = cbtm_rating`. Se existir conta com o mesmo e-mail, o sistema SHALL vincular `user_id`. A geração SHALL ser **idempotente** (confirmar duas vezes não duplica participantes).

#### Scenario: Confirmar gera 1 participante por divisão
- **WHEN** uma inscrição em 2 divisões é confirmada
- **THEN** são criados 2 participantes (um em cada divisão), ambos com `pot = cbtm_rating`

#### Scenario: Vínculo por e-mail
- **WHEN** o e-mail da inscrição corresponde a um usuário existente
- **THEN** os participantes gerados recebem o `user_id` desse usuário

#### Scenario: Confirmação idempotente
- **WHEN** uma inscrição já confirmada é confirmada novamente
- **THEN** nenhum participante é duplicado

#### Scenario: Rejeição não gera participantes
- **WHEN** o admin rejeita uma inscrição
- **THEN** nenhum participante é criado e a inscrição fica marcada como rejeitada

### Requirement: Modos de pagamento simulados (manual e free)
Nesta fase o sistema SHALL suportar apenas os modos `manual` e `free`. Em `free`, a inscrição SHALL ser **confirmada imediatamente**. Em `manual`, a inscrição SHALL ficar **pendente** até um admin confirmar ou rejeitar. O modo `gateway` (Mercado Pago) SHALL estar **indisponível** nesta fase.

#### Scenario: Evento gratuito confirma na hora
- **WHEN** uma inscrição é feita num evento com pagamento `free`
- **THEN** ela já nasce confirmada e gera os participantes imediatamente

#### Scenario: Modo manual aguarda o admin
- **WHEN** uma inscrição é feita num evento com pagamento `manual`
- **THEN** ela fica pendente e só gera participantes quando o admin confirma

#### Scenario: Gateway indisponível na Fase 2
- **WHEN** uma inscrição tenta usar o modo `gateway`
- **THEN** a operação é rejeitada informando que o pagamento automático estará disponível numa fase posterior

### Requirement: Painel admin de inscrições
O admin SHALL ver as inscrições de um evento e, para as pendentes (`manual`), **confirmar** ou **rejeitar** cada uma, com confirmação (`ConfirmModal`) nas ações de impacto.

#### Scenario: Confirmar inscrição pendente
- **WHEN** o admin confirma uma inscrição pendente
- **THEN** os participantes das divisões são gerados e a inscrição passa a confirmada

#### Scenario: Rejeitar inscrição pendente
- **WHEN** o admin rejeita uma inscrição pendente
- **THEN** a inscrição fica rejeitada e nenhum participante é criado
