# Migrations Workflow (HML -> PROD)

## O que sao migrations

Migrations sao mudancas incrementais e versionadas de schema (DDL), como:

- criar/alterar tabela
- criar indice
- criar/ajustar policy RLS
- criar/alterar enum, trigger, funcao

Elas nao sao copia de dados de um ambiente para outro.

## O que deve ficar identico entre HML e PROD

- **Schema**: sim, deve convergir para o mesmo estado apos promover as mesmas migrations.
- **Dados**: nao. HML e PROD devem ter dados diferentes por seguranca.

Quando voce faz merge `develop -> main`, o que e promovido e:

1. codigo da aplicacao
2. arquivos em `supabase/migrations`

No deploy de PROD, as migrations rodam em cima dos **dados reais de PROD**.

## Fluxo recomendado (real)

1. Criar migration nova em branch de feature.
2. Validar localmente.
3. Merge para `develop` e aplicar em HML.
4. Testar funcionalidade em HML.
5. Merge `develop -> main` e aplicar em PROD.

## Regra de ouro para mudancas sensiveis

Usar estrategia **expand/contract**:

1. expandir schema (adicionar coluna/tabela sem quebrar compatibilidade)
2. backfill (migrar dados)
3. app passa a usar novo schema
4. remover legado em migration posterior

Evite `DROP` imediato em tabelas/colunas usadas pelo app.

## Observacoes para este repositorio

- O historico de migrations local foi alinhado com o historico remoto.
- Existem migrations pendentes novas:
  - `supabase/migrations/20260219000100_realtime_notifications_pending_v1.sql`
  - `supabase/migrations/20260219000200_reconcile_matches_rls_with_remote.sql`
- Elas devem ser aplicadas primeiro em HML e depois em PROD.
