# Kickoff — Bloco B (desempate ITTF) — RETOMAR AQUI

> **Prompt para nova sessão:** *"Continuar o Bloco B. Leia `openspec/changes/bloco-b-desempate-ittf/KICKOFF.md` e siga a partir da task 3.4(b)."*

## Regras invioláveis
- **NUNCA aplicar nada em `main`/produção.** Só HML (VPS via túnel `ssh -L 5432:10.0.2.8:5432 andre@5.78.112.180`; `psql "postgresql://postgres:<senha do .mcp.json>@localhost:5432/postgres"`). MCP `supabase-hml__query` é read-only.
- **Nunca commitar em `main`** sem aval. Trabalhar na **develop**.
- Test-first. UI → skill `arena-design-pattern`. Migrations: só criar, o usuário aplica em prod.

## Onde estamos (branch develop)
Já commitado (feito e verde, 137 testes):
- **Núcleo do desempate** (`computeGroupStandings` reescrita, `breakTies` progressivo ITTF, pontos de game de `match.sets`) — commit `77169c5`. `GroupStanding` tem `gamePointsWon/Lost`.
- **Captura de sets + display via TS** — commit `b68e334`: ScoreSheet com inputs por set em jogos de grupo (+validação no `reportResultSchema`); `supabase-repo.getStandings` agora calcula no TS (não lê mais a view SQL).

Decisões do usuário: **arquitetura tudo-em-TS**; **pontos mantidos em 3/vitória** (2/1/0 + marcador de W.O. = follow-up, pois os dados não marcam W.O.).

## Checkpoint 1.1/1.2 (concluído — no design.md)
- Ranking exibido = view SQL `tournament_standings`; classificados (auto-avanço) = função SQL `tournament_group_standings` (chamada por `tournament_auto_advance_group`, reescrita no Bloco A). Ambos usavam critério simplificado.
- O **mock** já usa `computeGroupStandings` tanto p/ display quanto p/ auto-avanço → mock já é ITTF-consistente. Só a **produção SQL** diverge.

## ✅ ESTADO ATUAL (atualizado) — só falta validar em HML + arquivar
Implementação **concluída na develop** (18/20 tasks; falta só 6.3 HML e 6.5 smoke, ambos handoff do usuário):
- **3.4(b) feito:** `supabase-repo.advanceGroupQualifiers` decide os classificados no TS (ITTF/CBTM) e grava os slots do KO (incl. bye); ligado em `reportResult`/`walkover`/`closeGroupStage`. Auto-avanço SQL vira NO-OP: migration `20260701000100_tournament_auto_advance_group_noop.sql` (⚠️ NÃO aplicada).
- **5 (UI) feito:** coluna **PG** (pontos de game) + marcador **D**/tooltip + legenda em `standings-table.tsx` e na tabela do `GroupsTab`. Tokens Arena; tsc/lint/grep §3.1 limpos.
- **6:** vitest 137✓, lint✓, build exit 0✓, `openspec validate` ok✓. **Falta:** 6.3 aplicar/validar a migration em HML (túnel+psql, ROLLBACK) e 6.5 smoke manual.
- **Próximo:** validar em HML → `opsx:archive` do Bloco A e do Bloco B.

## (histórico) PRÓXIMO PASSO — task 3.4(b): classificados via TS (a parte que falta)
**Problema:** display já é TS-ITTF, mas os CLASSIFICADOS que avançam ainda saem do SQL (`tournament_group_standings`, critério antigo) → podem divergir do exibido em caso de empate. Consertar movendo a decisão p/ o TS.

**Plano sugerido:**
1. Novo método no repo (supabase) tipo `advanceGroupQualifiers(tournamentId, groupId)` que: se o grupo terminou, calcula `computeGroupStandings` (TS-ITTF), lê `tournament_group_slots` (map group_id+rank → match_id+match_slot), grava os classificados nos slots do KO e trata **avanço por bye** (jogo de 1ª rodada com 1 só slot → finaliza + propaga). Espelha a lógica que já existe no `mock-repo.autoAdvanceGroup` (que já faz isso em TS!).
2. A action `reportResult`/`closeGroupStage` chama esse método após lançar/fechar.
3. **Desabilitar o auto-avanço SQL** para não conflitar: migration idempotente que faz `tournament_auto_advance_group` virar no-op (ou `report_match_result` não chamar mais o avanço). ⚠️ criar a migration; validar em HML; **não aplicar em prod**.
4. Revalidar em HML (E2E: grupo com empate → exibição == classificados; byes seguem funcionando — usar o mesmo estilo de teste do Bloco A com ROLLBACK).

## Depois (tasks restantes)
- **5. UI** (skill arena-design-pattern): coluna/tooltip de **pontos de game** e indicação de desempate em `standings-table.tsx` e na tabela do `GroupsTab` (`src/app/admin/torneios/[id]/page.tsx`).
- **6. Verificação:** `vitest`, `lint`, `build`; `openspec validate bloco-b-desempate-ittf`; E2E HML; smoke manual (grupo com empate).
- Arquivar Bloco A e Bloco B com `opsx:archive` quando concluídos.

## Arquivos-chave
- `src/lib/tournaments/standings.ts` (computeGroupStandings + breakTies) — pronto.
- `tests/unit/standings.test.ts` — cenários de empate.
- `tests/helpers/mock-repo.ts` — `autoAdvanceGroup` (referência TS do avanço + byes).
- `src/lib/tournaments/repo/supabase-repo.ts` — `getStandings` (pronto), onde entra `advanceGroupQualifiers`.
- `src/app/actions/tournaments.ts` — `reportResult`, `closeGroupStage`.
- SQL vivo: `tournament_group_standings`, `tournament_auto_advance_group` (do Bloco A, migration `20260701000000_...byes.sql`).
