# scripts/migracao-prod

Scripts da virada de produção (Supabase Cloud → VPS self-hosted).
**Leia o runbook completo antes:** [`docs/RUNBOOK_VIRADA_PROD.md`](../../docs/RUNBOOK_VIRADA_PROD.md).

## Ordem de uso

| # | Script | Onde roda | Quando |
|---|--------|-----------|--------|
| — | `cp config.example.env config.env` e preencher | local | véspera |
| 1 | `./01-backup-e-dump-cloud.sh` | máquina com pg_dump≥15 + acesso ao Cloud | Fase 0 (sem downtime) |
| 1b | `./01-backup-e-dump-cloud.sh --apenas-dados` | idem | Fase 1 (já congelado) / Ensaio |
| 2 | `./02-restore-na-vps.sh` | NA VPS (ou com acesso ao PG da VPS) | Fase 3 / Ensaio |
| 3 | `./03-verificar.sh` | com acesso à VPS | Fase 4 / Ensaio |
| 4 | `./04-medir-latencia.sh URL_A URL_B [N] [rota]` | qualquer máquina com curl | Fase E (ensaio) |
| 5 | `./05-backup-cloud-para-r2.sh` | máquina com pg_dump≥15 + aws cli | apólice/rollback + rotina (cron) |

### Backup off-site do Cloud → Cloudflare R2 (script 5)

Faz `pg_dump` completo do Supabase Cloud e envia para um bucket R2, com retenção por
contagem. Use como **seguro antes da migração** e como **rotina recorrente** (o free
não tem backup gerenciado).

1. Crie um bucket no R2 (ex. `rankingpong-backup-prod`) e um **token de API** (Access Key + Secret).
2. Preencha as variáveis `R2_*` em `config.env`.
3. Rode manual hoje: `./05-backup-cloud-para-r2.sh`
4. (Opcional) agende no cron, ex. diário às 4h:
   ```cron
   0 4 * * * cd /caminho/scripts/migracao-prod && ./05-backup-cloud-para-r2.sh >> /var/log/backup-r2.log 2>&1
   ```

**Restaurar (rollback):** baixe o `.dump` do R2 e
`pg_restore --clean --if-exists --no-owner -d "$DB_URL_DESTINO" arquivo.dump`.

> **Ensaio primeiro (recomendado):** ver "Fase E — Ensaio (dry-run)" no runbook. Roda a VPS
> como produção com dados reais num domínio temporário, sem tocar no DNS do `smashpong`. Usa
> os scripts 1b → 2 → 3 e o 4 pra comparar velocidade VPS × Vercel.

Antes de rodar: `chmod +x *.sh`.

## Garantias de segurança embutidas

- **Backup completo do Cloud** antes de qualquer coisa (`backup-cloud-full.dump`).
- **Restore em transação única** com `session_replication_role = replica`: erro → `ROLLBACK`, HML antigo intacto.
- **Proteção anti-engano**: `02-restore-na-vps.sh` recusa rodar se a URL de destino apontar para o Cloud, e pede confirmação digitada (`VIRAR`).
- **Conferência de contagem** origem × destino no fim.

## O que NÃO migra (de propósito)

- Schema `auth`/`storage` DDL → gerenciado pelos containers do self-hosted (só migramos **dados** de `auth.users`/`auth.identities`).
- Sessões / refresh tokens → usuários relogam uma vez (senha mantida).
- Não há Storage nem Edge Functions neste projeto.

`config.env` e a pasta `dumps/` contêm segredos e dados reais — **nunca commitar** (já cobertos por `.env*` e a regra abaixo).
