/**
 * Vitest globalSetup — executa UMA vez antes e UMA vez depois de toda a suite.
 *
 * setup()    → purga resquícios de execuções anteriores interrompidas.
 * teardown() → garante limpeza final caso algum afterAll individual tenha falhado.
 *
 * Não substitui o afterAll de cada arquivo: o afterAll ainda é a primeira linha
 * de defesa e garante cleanup imediato após cada suite de arquivo.
 * O global-setup é a rede de segurança.
 */

import { purgeAllTestData } from "./helpers/cleanup";

export async function setup(): Promise<void> {
  const { deleted, failed } = await purgeAllTestData();
  if (deleted > 0 || failed > 0) {
    console.log(
      `[global-setup] Resquícios de execuções anteriores removidos: ` +
        `${deleted} excluídos, ${failed} falhas.`
    );
  }
}

export async function teardown(): Promise<void> {
  const { deleted, failed } = await purgeAllTestData();
  if (deleted > 0 || failed > 0) {
    console.log(
      `[global-teardown] Limpeza final: ${deleted} excluídos, ${failed} falhas.`
    );
  }
}
