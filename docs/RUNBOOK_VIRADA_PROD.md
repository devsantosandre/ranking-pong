# Runbook — Virada de Produção (Vercel/Cloud → VPS/self-hosted)

> **Objetivo:** inverter os papéis dos ambientes, sem perder nenhum dado.
>
> - **Hoje:** PROD = Vercel + Supabase Cloud (`wylndj…`) · HML = VPS (`5.78.112.180`) + Supabase self-hosted
> - **Depois:** PROD = **VPS + Supabase self-hosted** · HML = **Vercel + Supabase Cloud**
>
> **Quando executar:** de manhã, em janela de baixo fluxo. Reserve ~1h30 de folga.

---

## Decisões já tomadas

- Sobrescrever o banco self-hosted da VPS com os dados reais do Cloud (os dados de HML que estão hoje na VPS serão descartados).
- Janela de manutenção curta com **escrita congelada** na produção atual (Vercel) durante o dump → restore → cutover.
- O Cloud mantém os dados reais como estão; passa a ser HML (você limpa/anonimiza depois, se quiser).

## O que torna esta migração simples (já verificado no código)

- ❌ **Sem Supabase Storage** (nenhum upload/bucket) → não há arquivos binários a transferir.
- ❌ **Sem Edge Functions**.
- ✅ **Migrations de `develop` e `main` são idênticas** → schema da VPS já é igual ao do Cloud. Migração é **só de dados**.
- ✅ **Auth (login/senha):** migramos `auth.users` + `auth.identities` **com os hashes de senha** → ninguém perde a senha.
- ⚠️ **Sessões NÃO migram** (o JWT secret do self-hosted é diferente do Cloud). Consequência: **todos os usuários precisarão fazer login de novo** uma vez. A senha continua valendo.
- ⚠️ **Push (VAPID):** as `push_subscriptions` vêm do Cloud e foram geradas com a **chave VAPID de PROD**. A VPS, ao virar prod, **precisa usar as mesmas chaves VAPID de PROD** (não as de HML), senão o push para de funcionar para quem já estava inscrito.

---

## Estratégia recomendada: cutover em dois tempos (blue-green)

Em vez de fazer tudo de uma vez, divide-se em **HOJE (sem risco)** e **AMANHÃ (janela curta)**.
Isso reduz a janela de risco a "atualizar dados + virar URL" e mantém a Vercel como rede de segurança.

### HOJE (à tarde/noite) — preparar e validar, ZERO impacto no `smashpong`

- [ ] Rodar a **Fase E — Ensaio** completa: dados reais na VPS + app no domínio `teste.rankingpong.com.br` + smoke test + medir velocidade. O `smashpong` continua na Vercel o tempo todo.
- [ ] **Baixar o TTL do DNS** do `smashpong.rankingpong.com.br` para **300s** (ver Pré-requisitos). Faz a virada **e** o rollback de amanhã serem rápidos.
- [ ] Deixar pré-configurado no Coolify/Auth tudo que der, de forma que amanhã reste o mínimo.

### AMANHÃ DE MANHÃ (baixo fluxo) — atualizar dados + virar URL

> ⚠️ **"Atualizar o banco" = re-cópia completa, não delta.** O `02-restore-na-vps.sh` faz
> `TRUNCATE` + recarrega tudo. Os dados que você testou hoje são **substituídos** pelos frescos.
> Como o banco é pequeno, leva poucos minutos.

1. [ ] **Congelar escrita** na produção atual (Vercel/Cloud) — Fase 1.
2. [ ] **Re-copiar dados frescos:** `./01-backup-e-dump-cloud.sh --apenas-dados` → `./02-restore-na-vps.sh` → `./03-verificar.sh`.
3. [ ] **Reconfigurar domínio de `teste.` → `smashpong.`** (não é só DNS):
   - [ ] App (Coolify): `APP_BASE_URL`/`NEXT_PUBLIC_*URL` = `https://smashpong.rankingpong.com.br`.
   - [ ] GoTrue: `SITE_URL`/`ADDITIONAL_REDIRECT_URLS` = `https://smashpong.rankingpong.com.br` (reiniciar `auth`/`kong`).
   - [ ] Coolify: adicionar o domínio `smashpong…` ao app + SSL.
4. [ ] **Virar o DNS** (ver os dois cenários abaixo) e remover `smashpong` da Vercel.
5. [ ] **Smoke test IMEDIATO** (Fase 6): login real, registrar jogo, ranking, push, realtime.
6. [ ] OK → fim. Algo errado → **rollback agora** (janela limpa, ver abaixo).

### Virada e rollback do DNS — depende do Cloudflare

- **Se `rankingpong.com.br` está no Cloudflare com proxy (nuvem laranja):** virar = trocar a origem do registro `smashpong` para a VPS no painel Cloudflare → **quase instantâneo**. Rollback = trocar a origem de volta para a Vercel → **segundos**. O TTL do cliente quase não importa.
- **Se é DNS direto (sem proxy):** virar = trocar o registro (CNAME-Vercel → `A 5.78.112.180`). Rollback = voltar o registro para a Vercel. A rapidez depende do **TTL baixo** feito hoje.

### Rollback — a verdade sobre os dados

- **Logo após virar (minutos):** rollback **sem perda** — o Cloud ainda está idêntico, ninguém escreveu na VPS ainda. É a **janela limpa**; por isso o smoke test imediato.
- **Depois de horas de uso na VPS:** o rollback de DNS continua rápido, **mas** os registros criados na VPS nesse intervalo **não estão no Cloud** → seriam perdidos (ou teriam que ser migrados de volta manualmente). Decida cedo.

---

## Pré-requisitos (fazer NA VÉSPERA, sem downtime)

- [ ] **Reduzir o TTL do DNS** dos domínios envolvidos para 300s (5 min). Isso acelera a propagação no dia da virada. (Feito na véspera porque o TTL antigo ainda precisa expirar.)
- [ ] Instalar `pg_dump`/`psql` **v15+** na máquina de onde você vai rodar o dump (Mac: `brew install postgresql@17`). A versão precisa ser ≥ à do Postgres do Cloud.
- [ ] Pegar no dashboard do Supabase Cloud a **connection string** (use a do **Session pooler**, porta 5432) → vai em `SUPABASE_CLOUD_DB_URL`.
- [ ] Confirmar acesso SSH à VPS (`ssh andre@5.78.112.180`) e descobrir como acessar o Postgres self-hosted (nome do container Docker ou porta exposta) → vai em `VPS_PG_*` no config.
- [ ] Copiar `scripts/migracao-prod/config.example.env` para `config.env` e preencher (NÃO commitar — já está no `.gitignore` por ser `.env*`).
- [ ] **Decidir o mapeamento de domínios** (ver Fase 5). Anotar onde fica o DNS (Cloudflare/Registro.br/etc.).
- [ ] **(Recomendado) alinhar o código:** decidir se faz `merge develop → main` antes da virada, para a produção (VPS) rodar o código de `develop` e manter a convenção `main = prod`. Ver Fase 4.

---

## Fase E — Ensaio (dry-run) · OPCIONAL, ZERO risco, recomendado fazer primeiro

> **Faça esta fase dias/semanas antes da virada real.** Ela roda a VPS como produção,
> com **dados reais**, acessível por um **domínio temporário** — **sem tocar no DNS de
> `smashpong.rankingpong.com.br`**, que continua na Vercel o tempo todo. Ninguém vê o ensaio.
>
> Objetivo: ganhar confiança e **medir** (login, push, realtime e velocidade) antes de decidir virar.

1. [ ] **Copiar dados reais para a VPS** (o Cloud é lido em modo somente-leitura; **não precisa congelar** nada — é ensaio, dados podem estar levemente defasados):
   ```bash
   cd scripts/migracao-prod
   cp config.example.env config.env        # preencha (se ainda não fez)
   ./01-backup-e-dump-cloud.sh --apenas-dados
   # leve os dumps para a VPS e restaure:
   ./02-restore-na-vps.sh
   ./03-verificar.sh
   ```
2. [ ] **Configurar a app na VPS** com as envs de produção (VAPID de **PROD**, branding, `NODE_ENV=production`), mas com `APP_BASE_URL` = **domínio temporário** (ex. `https://teste.rankingpong.com.br`).
3. [ ] **Domínio temporário no Coolify:** adicionar `teste.rankingpong.com.br` ao app, apontar o DNS desse subdomínio para a VPS e emitir SSL. (É um subdomínio **novo** — não mexe no `smashpong`.)
4. [ ] **Ajustar Auth (GoTrue)** temporariamente: `SITE_URL`/`ADDITIONAL_REDIRECT_URLS` incluindo o domínio temporário (senão login/redirect quebram no ensaio).
5. [ ] **Smoke test completo** em `teste.rankingpong.com.br`:
   - [ ] Login com uma conta **real** (senha antiga funciona → hashes migraram).
   - [ ] Ranking e partidas carregam com dados reais.
   - [ ] Registrar um jogo de teste e confirmar (escrita + RLS + RPCs).
   - [ ] Realtime atualiza ao vivo.
   - [ ] Push de teste chega (confirma a VAPID de PROD).
6. [ ] **Medir velocidade** VPS vs Vercel, com número (não sensação):
   ```bash
   ./04-medir-latencia.sh https://teste.rankingpong.com.br https://smashpong.rankingpong.com.br
   ```
7. [ ] **Encerrar o ensaio:** decida — se for virar, siga para a Fase 0 (os dados serão **re-copiados frescos** do Cloud na virada real, então jogos de teste do ensaio são descartados naturalmente). Se não for virar agora, remova o domínio `teste.` e reverta o `SITE_URL` do GoTrue.

> **Resultado do ensaio = sua decisão informada.** Funcionou e ficou mais rápido sob dados reais → vire com confiança. Travou em algo → você descobriu sem risco e segue na Vercel.

---

## Fase 0 — Backup de segurança (rollback) · SEM downtime

Pode rodar com o app no ar, minutos antes da janela. Gera os backups que permitem desfazer tudo.

```bash
cd scripts/migracao-prod
cp config.example.env config.env   # preencha as variáveis
./01-backup-e-dump-cloud.sh
```

Esse script gera, na pasta `./dumps/`:

1. `backup-cloud-full.dump` — backup **completo** do Cloud (rollback do lado origem).
2. `data_auth.sql` — dados de `auth.users` + `auth.identities` (com hashes).
3. `data_public.sql` — dados de todas as tabelas do schema `public`.
4. `contagem-cloud.txt` — contagem de linhas por tabela (para conferência no fim).

- [ ] Os 4 arquivos existem e têm tamanho coerente (`data_public.sql` não pode estar vazio).
- [ ] Guarde uma cópia do `backup-cloud-full.dump` fora da máquina (drive/outro disco).

---

## Fase 1 — Congelar a produção atual (Vercel) · INÍCIO do downtime

Objetivo: garantir que **nenhum jogo/registro novo** entre depois do backup.

Escolha **uma** das opções (a mais simples que servir):

- **A (mais simples):** ative o **Maintenance Mode** do projeto na Vercel, ou faça um deploy de uma página estática de "em manutenção". Bloqueia todo o tráfego de escrita e leitura.
- **B (read-only fino):** revogue as permissões de escrita no Postgres do Cloud:
  ```sql
  -- no SQL Editor do Cloud
  ALTER ROLE authenticated  SET default_transaction_read_only = on;
  ALTER ROLE anon           SET default_transaction_read_only = on;
  -- (reverter no rollback com `... SET default_transaction_read_only = off;`)
  ```

- [ ] Produção em manutenção/read-only confirmada (tente registrar um jogo → deve falhar/bloquear).
- [ ] **Re-rode o dump de dados** agora (já congelado), para capturar o estado final:
  ```bash
  ./01-backup-e-dump-cloud.sh --apenas-dados
  ```

> A partir daqui o relógio corre. As fases 2–6 são o caminho crítico.

---

## Fase 2 — Backup do estado atual da VPS (rollback do destino)

```bash
ssh andre@5.78.112.180
# na VPS, com o Postgres self-hosted acessível:
pg_dump "$VPS_PG_URL" -Fc -f /opt/backups/backup-vps-antes-virada-$(date +%F).dump
```

- [ ] Backup da VPS gerado e com tamanho coerente.

---

## Fase 3 — Restaurar os dados do Cloud na VPS

Leve os dumps para a VPS (ou rode o script de uma máquina com acesso ao Postgres da VPS):

```bash
scp dumps/data_auth.sql dumps/data_public.sql andre@5.78.112.180:/opt/migrations/dados/
```

Na VPS, rode o restore (faz `TRUNCATE` das tabelas de HML e carrega os dados de prod, com triggers/FK desativados durante o load):

```bash
# na VPS, dentro de scripts/migracao-prod (ou copie 02-restore-na-vps.sh para lá)
./02-restore-na-vps.sh
```

O script:
1. Confere que está apontando para o Postgres **da VPS** (proteção contra rodar no lugar errado).
2. Abre **uma transação** com `session_replication_role = replica`.
3. `TRUNCATE` de todas as tabelas de `public` + `auth.identities`/`auth.users` (`CASCADE`).
4. Carrega `data_auth.sql` e depois `data_public.sql`.
5. As sequences são restauradas pelo próprio dump (`setval`).
6. `NOTIFY pgrst, 'reload schema';` para o PostgREST recarregar.

- [ ] Script terminou **sem erros** (qualquer erro → a transação faz `ROLLBACK`; ver Rollback no fim).

---

## Fase 4 — Conferir integridade dos dados

```bash
./03-verificar.sh   # compara contagem de linhas Cloud (Fase 1) x VPS
```

- [ ] Contagens de linhas batem entre Cloud e VPS para todas as tabelas relevantes.
- [ ] `SELECT count(*) FROM auth.users;` na VPS == no Cloud.
- [ ] Spot check: um usuário real existe na VPS (`SELECT email FROM auth.users LIMIT 5;`).
- [ ] Ranking/partidas com dados reais ao consultar via SQL.

> **Sobre o código (branches):** as migrations são idênticas, mas o código de app de `develop` está à frente de `main`.
> - Se quiser que a VPS-prod rode o código novo **e** manter `main = prod`: faça `git checkout main && git merge develop && git push` **antes** da Fase 5, e ajuste os workflows (abaixo) para que o deploy da VPS dispare em `main`.
> - Se preferir o caminho mínimo agora: a VPS continua deployando de `develop` (código novo) e o Cloud/Vercel de `main` (HML). Funciona, mas inverte a convenção de branches — alinhe depois com calma.

---

## Fase 5 — Cutover: domínios, env e CI

### 5.1 Variáveis de ambiente da VPS (Coolify) — agora é PROD

No serviço do app no Coolify, ajuste as envs para **produção**:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SERVICE_ROLE_KEY` → **mantêm** os valores do **self-hosted** (o banco é o mesmo container; não muda).
- [ ] **VAPID** → trocar para as chaves de **PROD** (`.env.production.local`): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. **Crítico** para o push dos usuários existentes.
- [ ] **Branding** → as variáveis `NEXT_PUBLIC_PRODUCT_*`, cores, logos (identidade Smash Pong de prod).
- [ ] `APP_BASE_URL` / `NEXT_PUBLIC_*URL` → `https://smashpong.rankingpong.com.br` (a URL de prod não muda).
- [ ] `NODE_ENV=production`.

### 5.2 Auth do Supabase self-hosted (GoTrue)

No `.env` do stack Supabase self-hosted na VPS (e reiniciar os containers `auth`/`kong`):

- [ ] `SITE_URL` = `https://smashpong.rankingpong.com.br`.
- [ ] `ADDITIONAL_REDIRECT_URLS` = inclui `https://smashpong.rankingpong.com.br`.
- [ ] `API_EXTERNAL_URL` = URL pública do Supabase self-hosted (se usado por links de e-mail).

### 5.3 Domínios / DNS

> **A URL de produção NÃO muda de nome:** continua `https://smashpong.rankingpong.com.br/`.
> Só troca o **destino**: Vercel → Coolify/VPS. Isso evita qualquer mudança de URL para os usuários.

Ordem para minimizar downtime e deixar o SSL emitir certo (o Let's Encrypt HTTP-01 do Coolify só valida **depois** que o DNS já aponta para a VPS):

1. [ ] **Coolify (antes do DNS):** adicionar `smashpong.rankingpong.com.br` como domínio do serviço do app e habilitar SSL automático. Vai ficar "pendente" até o DNS apontar — normal.
2. [ ] **Vercel:** remover `smashpong.rankingpong.com.br` do projeto (libera o domínio; a Vercel deixa de respondê-lo).
3. [ ] **DNS:** repontar `smashpong.rankingpong.com.br` para a VPS — trocar de CNAME-Vercel para `A` → `5.78.112.180` (ou conforme o proxy/Cloudflare). TTL já baixo desde a véspera.
4. [ ] Aguardar propagação e o **Coolify emitir o certificado** (cadeado válido em `https://smashpong.rankingpong.com.br`).

Domínio de HML (o Cloud/Vercel vira homologação):

5. [ ] Definir o domínio de HML (reutilizar o que a VPS usava para HML, ou um novo `hml.…`).
6. [ ] **DNS:** apontar esse domínio de HML para a **Vercel** (CNAME do projeto).
7. [ ] **Vercel:** adicionar esse domínio de HML ao projeto (que agora serve homologação a partir do Cloud).

### 5.4 CI/CD (GitHub Actions) — inverter alvos

Hoje (`.github/workflows/`):
- `supabase-prod.yml`: push em `main` → `supabase db push` no **Cloud**.
- `supabase-hml.yml`: push em `develop` → SSH VPS + Coolify deploy.

Depois da virada, **o deploy da VPS é o de PROD** e **o `db push` do Cloud é o de HML**. Ver os diffs prontos em `docs/RUNBOOK_VIRADA_PROD-ci-changes.md` (Fase 6). Resumo:
- [ ] Workflow que faz SSH/Coolify (VPS) passa a disparar na branch de **prod**.
- [ ] Workflow que faz `supabase db push` (Cloud) passa a disparar na branch de **hml**.
- [ ] Conferir os **Secrets** do GitHub (renomear de prod↔hml se quiser manter a semântica dos nomes).

---

## Fase 6 — Smoke test em produção (VPS) e fim do downtime

Com o domínio de prod já apontando para a VPS:

- [ ] Abre o app no domínio de produção, carrega o **ranking** com dados reais.
- [ ] **Login** com uma conta real (senha antiga deve funcionar — confirma a migração dos hashes).
- [ ] Registrar um **jogo de teste** e confirmar (testa escrita + RLS + RPCs).
- [ ] **Realtime**: a tela de partidas atualiza ao vivo.
- [ ] **Push**: dispara uma notificação de teste para um inscrito.
- [ ] Tudo OK → **reabrir a produção** (desfazer o modo manutenção da Vercel **só se** ainda estiver servindo; mas como o domínio já migrou para a VPS, a Vercel passa a ser HML).

- [ ] **HML (Vercel/Cloud):** desfazer o read-only se usou a Opção B da Fase 1:
  ```sql
  ALTER ROLE authenticated SET default_transaction_read_only = off;
  ALTER ROLE anon          SET default_transaction_read_only = off;
  ```

---

## Plano de Rollback (se algo der errado)

A produção antiga (Vercel/Cloud) **continua intacta** até você trocar o DNS. Por isso o cutover de DNS é o **ponto de não-retorno suave**.

1. **Antes do DNS trocar:** basta abortar — reabrir a Vercel (tirar manutenção / read-only). Nada foi perdido.
2. **Depois do DNS trocar, se a VPS falhar:** reverter o DNS do domínio de prod de volta para a Vercel, reabrir a Vercel. Como a janela foi com escrita congelada, o Cloud ainda tem o estado íntegro.
3. **Banco da VPS corrompido no restore:** o `02-restore-na-vps.sh` roda em transação única — erro = `ROLLBACK` automático, HML antigo permanece. Se precisar, restaure `backup-vps-antes-virada-*.dump`.
4. **Backup completo do Cloud:** `backup-cloud-full.dump` permite recriar tudo do zero em qualquer Postgres.

---

## Checklist final

- [ ] Backups guardados (Cloud full + VPS antes-virada) em local seguro.
- [ ] Contagens de linhas conferidas.
- [ ] Login real funciona na VPS-prod.
- [ ] Push funciona (VAPID de prod na VPS).
- [ ] DNS de prod → VPS com SSL válido.
- [ ] DNS de hml → Vercel.
- [ ] Workflows de CI invertidos e testados.
- [ ] HML (Cloud) com read-only desfeito.
