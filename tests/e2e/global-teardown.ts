/**
 * Playwright globalTeardown — executa UMA vez após toda a suíte E2E.
 *
 * Garante que usuários de teste criados em qualquer spec (inclusive aqueles
 * cujo afterAll não rodou por crash ou timeout) sejam excluídos do Supabase.
 *
 * Complementa, mas não substitui, o afterAll de cada spec:
 *  - afterAll → limpeza imediata ao final de cada arquivo (primeira linha de defesa)
 *  - globalSetup  → remove resquícios de execuções anteriores interrompidas
 *  - globalTeardown → rede de segurança: limpa tudo que sobrou nesta execução
 */

import { purgeAllTestData } from "../helpers/cleanup";

export default async function globalTeardown(): Promise<void> {
  const { deleted, failed } = await purgeAllTestData();
  if (deleted > 0 || failed > 0) {
    console.log(
      `[e2e/global-teardown] Limpeza final: ${deleted} excluídos, ${failed} falhas.`
    );
  }
}
