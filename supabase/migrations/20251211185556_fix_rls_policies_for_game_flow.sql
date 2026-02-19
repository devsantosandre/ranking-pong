-- Remover politicas antigas problematicas
DROP POLICY IF EXISTS "Jogadores podem atualizar suas matches" ON matches;

-- Adicionar politica de UPDATE para matches (jogadores da partida podem atualizar)
CREATE POLICY "Jogadores podem atualizar matches" ON matches
FOR UPDATE TO authenticated
USING (
  player_a_id = auth.uid() OR player_b_id = auth.uid()
)
WITH CHECK (
  player_a_id = auth.uid() OR player_b_id = auth.uid()
);

-- Politica para usuarios atualizarem rating de outros (necessario para confirmar partida)
DROP POLICY IF EXISTS "Usuarios podem atualizar seus proprios dados" ON users;
DROP POLICY IF EXISTS "Usuarios podem editar proprio perfil" ON users;

CREATE POLICY "Usuarios autenticados podem atualizar users" ON users
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- Garantir que rating_transactions pode ser inserido
DROP POLICY IF EXISTS "Sistema pode criar rating_transactions" ON rating_transactions;

CREATE POLICY "Usuarios autenticados podem inserir rating_transactions" ON rating_transactions
FOR INSERT TO authenticated
WITH CHECK (true);

-- Garantir SELECT em rating_transactions
DROP POLICY IF EXISTS "Usuarios autenticados podem ver rating_transactions" ON rating_transactions;

CREATE POLICY "Usuarios autenticados podem ver rating_transactions" ON rating_transactions
FOR SELECT TO authenticated
USING (true);
