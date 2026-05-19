/**
 * Playwright globalSetup — executa antes de todos os testes E2E.
 * Limpa resquícios de usuários criados por execuções anteriores interrompidas.
 */

import { purgeAllTestData } from "../helpers/cleanup";

export default async function globalSetup(): Promise<void> {
  const { deleted, failed } = await purgeAllTestData();
  if (deleted > 0 || failed > 0) {
    console.log(
      `[e2e/global-setup] Resquícios removidos: ${deleted} excluídos, ${failed} falhas.`
    );
  }
}
