# Validação em HML — Bloco B (desempate ITTF)

> Tasks 6.3 (E2E/migration em HML) e 6.5 (smoke). **Só HML, nunca prod.**
> O ambiente do Claude não alcança o HML (host `supabase-api.alsstech.com.br` fora
> da rede + MCP `supabase-hml__query` é read-only). Rodar você, pelo túnel.

## Por que não é um teste SQL puro
O desempate e a decisão de classificados agora vivem no **TypeScript**
(`supabase-repo.advanceGroupQualifiers` → `computeGroupStandings`). O SQL
`tournament_auto_advance_group` virou **no-op** (migration `20260701000100`).
Logo, a validação comportamental precisa passar pela **app apontada ao HML**, não
só por `psql`. O `psql` serve para (a) aplicar a migration e (b) inspecionar o
estado depois.

## Passo 1 — abrir o túnel
```bash
ssh -L 5432:10.0.2.8:5432 andre@5.78.112.180
# noutro terminal, senha do .mcp.json:
psql "postgresql://postgres:<senha>@localhost:5432/postgres"
```

## Passo 2 — aplicar a migration no HML
```bash
psql "postgresql://postgres:<senha>@localhost:5432/postgres" \
  -f supabase/migrations/20260701000100_tournament_auto_advance_group_noop.sql
```
Conferir que virou no-op (corpo sem loops/updates, só `return;`):
```sql
select pg_get_functiondef('tournament_auto_advance_group(uuid,text)'::regprocedure);
```

## Passo 3 — smoke pela app apontada ao HML (6.5)
Rodar a app com as envs do HML e, como admin:
1. Criar torneio `groups_knockout`, 1 grupo com jogadores que vão **empatar em
   pontos** (ex.: 3 jogadores num ciclo A>B>C>A → todos 1V/1D, mesmos pontos).
   Lançar o **placar por set** em cada jogo (a coluna `sets` alimenta o 3º critério).
2. Ao fechar o grupo, conferir na tabela (`GroupsTab` / `standings-table`):
   - coluna **PG** (pontos de game) preenchida;
   - marcador **D** + tooltip nas linhas empatadas;
   - a **ordem exibida** segue razão de sets → razão de pontos de game.
3. Conferir que os **classificados que avançam** ao mata-mata são exatamente os
   top-N exibidos (mesma ordem). É esta paridade exibição==classificados que o
   Bloco B corrige.

## Passo 4 — checagem SQL de apoio (opcional, read-only)
Depois do smoke, confirmar que os slots do KO receberam quem a tabela mostra:
```sql
-- classificados gravados nos slots do mata-mata
select gs.group_id, gs.rank, gs.match_slot, m.participant_a_id, m.participant_b_id
from tournament_group_slots gs
join tournament_matches m on m.id = gs.match_id
where gs.tournament_id = '<TOURNAMENT_ID>'
order by gs.group_id, gs.rank;
```

## Critério de aceite
- [ ] Migration aplicada; `tournament_auto_advance_group` é no-op no HML.
- [ ] Grupo com empate: ordem exibida == classificados que avançam.
- [ ] Byes seguem avançando (grupo cujo top-N cai contra bye no KO).
- [ ] Coluna PG + marcador D aparecem corretamente.

Depois disso: marcar 6.3/6.5 e `opsx:archive` (Bloco A e Bloco B).
