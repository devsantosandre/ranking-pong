# Plano: Area de Administrador - Ranking Pong

## Resumo Executivo

Implementar uma area de administrador completa com sistema de 3 niveis de permissao (user/moderator/admin), acessivel via nova aba "Admin" na navegacao, com funcionalidades para gerenciar partidas, jogadores e configuracoes do sistema.

---

## Indice

1. [Tipos de Usuario](#1-tipos-de-usuario)
2. [Banco de Dados](#2-banco-de-dados)
3. [Backend](#3-backend)
4. [Frontend](#4-frontend)
5. [Paginas Admin](#5-paginas-admin)
6. [Arquivos a Modificar/Criar](#6-arquivos-a-modificarcriar)
7. [Ordem de Implementacao](#7-ordem-de-implementacao)
8. [Integracoes Dinamicas](#8-integracoes-dinamicas)
9. [Regras de Negocio](#9-regras-de-negocio)
10. [Checklist de Funcionalidades](#10-checklist-de-funcionalidades)

---

## 1. Tipos de Usuario

### Hierarquia de Roles

| Role | Descricao | Pode Jogar | Acessa Admin |
|------|-----------|:----------:|:------------:|
| `user` | Jogador comum | Sim | Nao |
| `moderator` | Admin limitado | Sim | Sim |
| `admin` | Admin completo | Sim | Sim |

### Tabela de Permissoes

| Acao | user | moderator | admin |
|------|:----:|:---------:|:-----:|
| Registrar proprias partidas | ✅ | ✅ | ✅ |
| Ver ranking/noticias | ✅ | ✅ | ✅ |
| Alterar propria senha | ✅ | ✅ | ✅ |
| Acessar area admin | ❌ | ✅ | ✅ |
| Adicionar jogadores | ❌ | ✅ | ✅ |
| Resetar senha de outros | ❌ | ✅ | ✅ |
| Cancelar partidas | ❌ | ✅ | ✅ |
| Editar pontos manualmente | ❌ | ❌ | ✅ |
| Ativar/desativar jogadores | ❌ | ❌ | ✅ |
| Resetar estatisticas | ❌ | ❌ | ✅ |
| Alterar roles | ❌ | ❌ | ✅ |
| Alterar configuracoes | ❌ | ❌ | ✅ |

### Regras para Jogador Desativado (is_active = false)

- NAO pode fazer login (bloqueado na autenticacao)
- NAO aparece no ranking
- NAO aparece na lista de adversarios ao registrar partida
- NAO pode ter partidas registradas contra ele

---

## 2. Banco de Dados

### 2.1 Alterar tabela `users`

```sql
-- Adicionar coluna role com 3 niveis
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'
  CHECK (role IN ('user', 'moderator', 'admin'));

-- Adicionar coluna para status ativo/inativo
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Criar indice para buscas por role
CREATE INDEX idx_users_role ON users(role);
```

### 2.2 Criar tabela `settings`

```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Inserir configuracoes padrao
INSERT INTO settings (key, value, description) VALUES
  ('pontos_vitoria', '20', 'Pontos ganhos por vitoria'),
  ('pontos_derrota', '8', 'Pontos ganhos por derrota'),
  ('limite_jogos_diarios', '2', 'Limite de jogos por dia contra mesmo adversario'),
  ('rating_inicial', '250', 'Rating inicial para novos jogadores');
```

### 2.3 Criar tabela `admin_logs` (auditoria)

```sql
CREATE TABLE admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id) NOT NULL,
  admin_role TEXT NOT NULL,              -- role do admin no momento da acao
  action TEXT NOT NULL,                  -- tipo da acao
  action_description TEXT NOT NULL,      -- descricao legivel da acao
  target_type TEXT NOT NULL,             -- 'user', 'match', 'setting'
  target_id UUID,
  target_name TEXT,                      -- nome do alvo para facil leitura
  old_value JSONB,
  new_value JSONB,
  reason TEXT,                           -- motivo da acao (quando aplicavel)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para performance
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);
```

### 2.4 Tipos de Acoes para Auditoria

| Acao | Descricao | Quem pode |
|------|-----------|-----------|
| `user_created` | Jogador criado | moderator, admin |
| `user_password_reset` | Senha resetada | moderator, admin |
| `user_activated` | Jogador ativado | admin |
| `user_deactivated` | Jogador desativado | admin |
| `user_stats_reset` | Estatisticas zeradas | admin |
| `user_rating_changed` | Pontos alterados manualmente | admin |
| `user_role_changed` | Role alterado (promocao/democao) | admin |
| `match_cancelled` | Partida cancelada | moderator, admin |
| `setting_changed` | Configuracao alterada | admin |

### 2.5 Exemplo de Log

```json
{
  "admin_id": "uuid-do-admin",
  "admin_role": "moderator",
  "action": "match_cancelled",
  "action_description": "Partida cancelada e pontos revertidos",
  "target_type": "match",
  "target_id": "uuid-da-partida",
  "target_name": "Joao vs Maria (3x2)",
  "old_value": { "status": "validado", "pontos_a": 20, "pontos_b": 8 },
  "new_value": { "status": "cancelado" },
  "reason": "Placar registrado incorretamente pelo jogador",
  "created_at": "2025-12-21T10:30:00Z"
}
```

### 2.6 Promover Primeiro Admin

```sql
UPDATE users SET role = 'admin' WHERE email = 'SEU_EMAIL_AQUI';
```

---

## 3. Backend

### 3.1 Helper de Verificacao de Admin

**Novo arquivo: `src/lib/admin.ts`**

```typescript
// Funcoes a implementar:
getCurrentUserRole()    // Retorna role do usuario atual
requireModerator()      // Lanca erro se nao for moderator OU admin
requireAdminOnly()      // Lanca erro se nao for admin
```

### 3.2 Server Actions Administrativas

**Novo arquivo: `src/app/actions/admin.ts`**

#### Partidas (moderator + admin)

| Funcao | Descricao |
|--------|-----------|
| `adminGetAllMatches(filters?)` | Listar todas as partidas |
| `adminCancelMatch(matchId, reason)` | Cancelar partida |

**Logica de cancelamento:**
- Se `pendente`: apenas muda status para `cancelado`
- Se `validado`: reverte pontos dos jogadores + muda status para `cancelado`

#### Jogadores - Moderator + Admin

| Funcao | Descricao |
|--------|-----------|
| `adminGetAllUsers()` | Listar todos os usuarios |
| `adminCreateUser(name, email, tempPassword)` | Criar jogador com senha temporaria |
| `adminResetPassword(userId, newTempPassword)` | Resetar senha do jogador |

#### Jogadores - Apenas Admin

| Funcao | Descricao |
|--------|-----------|
| `adminUpdateUserRating(userId, newRating, reason)` | Ajustar pontos manualmente |
| `adminToggleUserStatus(userId)` | Ativar/desativar jogador |
| `adminResetUserStats(userId)` | Resetar estatisticas (zerar V/D/pontos) |
| `adminChangeUserRole(userId, newRole)` | Promover/demover role |

**Regra importante:** Admin NAO pode alterar seu proprio role (evita ficar sem admin)

#### Configuracoes - Apenas Admin

| Funcao | Descricao |
|--------|-----------|
| `adminGetSettings()` | Buscar configuracoes |
| `adminUpdateSetting(key, value)` | Atualizar configuracao |

#### Logs

| Funcao | Descricao |
|--------|-----------|
| `adminGetLogs(limit?)` | Buscar historico de acoes |

### 3.3 Server Action para Perfil

**Novo arquivo: `src/app/actions/profile.ts`**

| Funcao | Descricao |
|--------|-----------|
| `changePassword(currentPassword, newPassword)` | Alterar propria senha |

### 3.4 Validacoes Importantes

- `adminCreateUser`: Verificar se email ja existe antes de criar
- `adminChangeUserRole`: Bloquear se admin tentar se auto-demover
- `adminCancelMatch`: Exigir motivo obrigatorio

---

## 4. Frontend

### 4.1 Atualizar AuthStore

**Modificar: `src/lib/auth-store.tsx`**

```typescript
// Adicionar ao tipo AuthUser:
type AuthUser = {
  id: string;
  name: string;
  email?: string;
  rating?: number;
  role: 'user' | 'moderator' | 'admin';  // NOVO
  isActive: boolean;                       // NOVO
};

// Adicionar helpers ao contexto:
isAdmin        // true se role === 'admin'
isModerator    // true se role === 'moderator'
canAccessAdmin // true se role === 'admin' OU 'moderator'
```

### 4.2 Atualizar Navegacao

**Modificar: `src/components/app-shell.tsx`**

- Importar icone `Shield` do lucide-react
- Tornar `navItems` dinamico baseado em `canAccessAdmin`
- Adicionar aba "Admin" para moderators e admins

### 4.3 Hooks React Query para Admin

**Novo arquivo: `src/lib/queries/use-admin.ts`**

```typescript
// Queries
useAdminMatches(filters?)  // Query de partidas
useAdminUsers()            // Query de usuarios
useAdminSettings()         // Query de configuracoes
useAdminLogs()             // Query de logs

// Mutations
useAdminCancelMatch()
useAdminCreateUser()
useAdminResetPassword()
useAdminUpdateUserRating()
useAdminToggleUserStatus()
useAdminResetUserStats()
useAdminChangeUserRole()
useAdminUpdateSetting()
```

---

## 5. Paginas Admin

### Estrutura de Arquivos

```
src/app/admin/
├── layout.tsx              # Protecao + verificacao de admin
├── page.tsx                # Dashboard com links para secoes
├── partidas/page.tsx       # Gerenciar partidas
├── jogadores/page.tsx      # Gerenciar jogadores
├── configuracoes/page.tsx  # Configurar regras
└── logs/page.tsx           # Historico de acoes
```

### 5.1 `/admin` (Dashboard)

- Cards com links para cada secao
- Icones: Gamepad2, Users, Settings, History
- Contador de partidas pendentes
- Contador de jogadores ativos

### 5.2 `/admin/partidas`

**Funcionalidades:**
- Filtros por status (Todas, Pendentes, Validadas, Canceladas)
- Lista de partidas com: Jogadores, placar, status, data
- Botao "Cancelar" com campo obrigatorio de motivo

**Ao cancelar partida validada:**
1. Pontos sao revertidos automaticamente
2. Log registrado com motivo
3. Jogadores podem registrar novamente com placar correto

### 5.3 `/admin/jogadores`

**Funcionalidades:**
- Botao "Adicionar Jogador" no topo
- Formulario para criar jogador (nome, email, senha temporaria)
- Lista de jogadores ordenada por rating
- Busca por nome
- Badge visual mostrando role (user/moderator/admin)
- Badge visual para jogadores inativos

**Acoes disponiveis (baseado no role do admin logado):**

| Acao | moderator | admin |
|------|:---------:|:-----:|
| Resetar senha | ✅ | ✅ |
| Editar pontos (com motivo) | ❌ | ✅ |
| Ativar/Desativar | ❌ | ✅ |
| Resetar estatisticas | ❌ | ✅ |
| Alterar role | ❌ | ✅ |

### 5.4 `/admin/configuracoes`

**Cards editaveis para cada configuracao:**
- Pontos por vitoria (padrao: 20)
- Pontos por derrota (padrao: 8)
- Limite diario de jogos (padrao: 2)
- Rating inicial (padrao: 250)

### 5.5 `/admin/logs`

**Funcionalidades:**
- Lista cronologica de acoes administrativas
- Filtros por tipo de acao e por admin

**Cada log mostra:**
- **Quem**: Nome do admin + role no momento
- **O que**: Descricao legivel da acao
- **Alvo**: Nome do jogador/partida afetada
- **Quando**: Data/hora
- **Motivo**: Quando aplicavel (ex: cancelamento de partida)
- **Detalhes**: Valores antes/depois (expansivel)

**Exemplo visual:**
```
┌─────────────────────────────────────────────────────┐
│ 🔴 Partida cancelada                    ha 2 horas  │
│ Admin: Joao Silva (moderator)                       │
│ Partida: Pedro vs Maria (3x2)                       │
│ Motivo: "Placar registrado incorretamente"          │
│ [Ver detalhes ▼]                                    │
└─────────────────────────────────────────────────────┘
```

### 5.6 `/perfil` (modificar pagina existente)

**Adicionar secao "Seguranca":**
- Formulario para alterar senha
  - Senha atual
  - Nova senha
  - Confirmar nova senha

---

## 6. Arquivos a Modificar/Criar

| Arquivo | Acao |
|---------|------|
| `src/lib/auth-store.tsx` | Modificar - adicionar role/isAdmin |
| `src/components/app-shell.tsx` | Modificar - aba Admin dinamica |
| `src/lib/admin.ts` | **Criar** - helpers de verificacao |
| `src/app/actions/admin.ts` | **Criar** - server actions admin |
| `src/app/actions/profile.ts` | **Criar** - server action alterar senha |
| `src/lib/queries/use-admin.ts` | **Criar** - hooks React Query admin |
| `src/lib/queries/query-keys.ts` | Modificar - adicionar keys admin |
| `src/app/admin/layout.tsx` | **Criar** - layout protegido |
| `src/app/admin/page.tsx` | **Criar** - dashboard |
| `src/app/admin/partidas/page.tsx` | **Criar** - gerenciar partidas |
| `src/app/admin/jogadores/page.tsx` | **Criar** - gerenciar jogadores |
| `src/app/admin/configuracoes/page.tsx` | **Criar** - configuracoes |
| `src/app/admin/logs/page.tsx` | **Criar** - historico |
| `src/app/perfil/page.tsx` | Modificar - adicionar secao alterar senha |
| `src/app/actions/matches.ts` | Modificar - usar settings dinamicas |
| `src/lib/queries/use-users.ts` | Modificar - filtrar usuarios ativos |

---

## 7. Ordem de Implementacao

### Fase 1: Banco de Dados
1. Adicionar colunas `role` e `is_active` na tabela `users`
2. Criar tabela `settings` com valores padrao
3. Criar tabela `admin_logs`
4. Promover primeiro admin manualmente

### Fase 2: Backend Base
5. Criar `src/lib/admin.ts` com helpers de verificacao
6. Criar `src/app/actions/admin.ts` com server actions
7. Criar `src/app/actions/profile.ts` para alterar senha

### Fase 3: Frontend Base
8. Atualizar `src/lib/auth-store.tsx` com role e helpers
9. Atualizar `src/components/app-shell.tsx` com aba Admin
10. Criar `src/lib/queries/use-admin.ts` com hooks

### Fase 4: Paginas Admin
11. Criar `src/app/admin/layout.tsx` (protecao)
12. Criar `src/app/admin/page.tsx` (dashboard)
13. Criar `src/app/admin/partidas/page.tsx`
14. Criar `src/app/admin/jogadores/page.tsx`
15. Criar `src/app/admin/configuracoes/page.tsx`
16. Criar `src/app/admin/logs/page.tsx`

### Fase 5: Integracoes
17. Modificar `src/app/perfil/page.tsx` (alterar senha)
18. Atualizar `src/app/actions/matches.ts` (settings dinamicas)
19. Atualizar queries para filtrar usuarios ativos

---

## 8. Integracoes Dinamicas

### 8.1 Pontos por Vitoria/Derrota

**Arquivo: `src/app/actions/matches.ts`**

```typescript
// ANTES (fixo)
const myDelta = isWinner ? 20 : 8;

// DEPOIS (dinamico)
const { data: settings } = await supabase
  .from("settings")
  .select("key, value")
  .in("key", ["pontos_vitoria", "pontos_derrota"]);

const pontosVitoria = parseInt(
  settings?.find(s => s.key === "pontos_vitoria")?.value || "20"
);
const pontosDerrota = parseInt(
  settings?.find(s => s.key === "pontos_derrota")?.value || "8"
);

const myDelta = isWinner ? pontosVitoria : pontosDerrota;
```

### 8.2 Limite de Jogos Diarios

```typescript
// ANTES (fixo)
if (jogosHoje >= 2) { ... }

// DEPOIS (dinamico)
const { data: limiteSetting } = await supabase
  .from("settings")
  .select("value")
  .eq("key", "limite_jogos_diarios")
  .single();

const limiteJogosDiarios = parseInt(limiteSetting?.value || "2");

if (jogosHoje >= limiteJogosDiarios) {
  throw new Error(
    `Limite de ${limiteJogosDiarios} jogos por dia contra este adversario`
  );
}
```

### 8.3 Filtrar Apenas Jogadores Ativos

```typescript
// Na lista de adversarios ao registrar partida
const { data: users } = await supabase
  .from("users")
  .select("*")
  .eq("is_active", true)  // Apenas jogadores ativos
  .neq("id", currentUserId);
```

---

## 9. Regras de Negocio

### 9.1 Seguranca de Acesso

1. **Frontend**: Aba "Admin" so aparece para moderator/admin
2. **Backend**: Toda server action verifica role antes de executar
3. **Banco**: Mesmo burlando frontend, banco rejeita operacoes nao autorizadas

### 9.2 Protecao contra Perda de Admin

- Admin NAO pode alterar seu proprio role
- Sempre deve existir pelo menos 1 admin no sistema

### 9.3 Cancelamento de Partidas

| Status | Comportamento |
|--------|---------------|
| `pendente` | Apenas muda status para `cancelado` |
| `validado` | Reverte pontos + muda status para `cancelado` |

### 9.4 Auditoria Obrigatoria

Toda acao administrativa DEVE:
1. Registrar log na tabela `admin_logs`
2. Incluir motivo quando aplicavel (cancelamentos, edicoes de pontos)
3. Guardar valores antes/depois para rastreabilidade

### 9.5 Criacao de Jogadores

1. Admin/Moderator cria jogador com senha temporaria
2. Passa senha por WhatsApp/pessoalmente
3. Jogador faz login e pode alterar senha no perfil
4. Se esquecer senha, admin pode resetar

---

## 10. Checklist de Funcionalidades

### Alta Prioridade
- [ ] Sistema de 3 roles (user/moderator/admin)
- [ ] Criar jogadores com senha temporaria
- [ ] Cancelar partidas (com reversao de pontos)
- [ ] Alterar senha no perfil

### Media Prioridade
- [ ] Gerenciar jogadores (ativar/desativar, editar pontos, resetar stats)
- [ ] Configuracoes dinamicas de regras
- [ ] Logs de auditoria detalhados

### Baixa Prioridade
- [ ] Filtros avancados nos logs
- [ ] Bloquear login de jogadores inativos
- [ ] Dashboard com estatisticas

---

## Fluxos de Uso

### Fluxo: Adicionar Novo Jogador

```
Admin acessa /admin/jogadores
    ↓
Clica "Adicionar Jogador"
    ↓
Preenche: Nome, Email, Senha temporaria
    ↓
Sistema cria usuario no Supabase Auth + tabela users
    ↓
Log registrado: "user_created"
    ↓
Admin avisa jogador: "Seu login: email, senha: 123456"
    ↓
Jogador faz login e altera senha no perfil
```

### Fluxo: Cancelar Partida com Placar Errado

```
Moderator acessa /admin/partidas
    ↓
Encontra partida com placar errado
    ↓
Clica "Cancelar"
    ↓
Preenche motivo: "Placar registrado incorretamente"
    ↓
Sistema reverte pontos (se validada)
    ↓
Log registrado: "match_cancelled" com motivo
    ↓
Jogadores registram novamente com placar correto
```

### Fluxo: Jogador Esqueceu Senha

```
Jogador avisa admin que esqueceu senha
    ↓
Admin acessa /admin/jogadores
    ↓
Encontra jogador e clica "Resetar Senha"
    ↓
Define nova senha temporaria
    ↓
Log registrado: "user_password_reset"
    ↓
Admin avisa jogador a nova senha
    ↓
Jogador faz login e altera senha no perfil
```

---

*Documento gerado em: 21/12/2025*
*Projeto: Ranking Pong - Sistema de Ranking de Ping Pong*
