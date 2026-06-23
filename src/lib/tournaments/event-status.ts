import type { TournamentStatus } from "./types";

/**
 * Status "predominante" de um evento a partir do status de suas divisões.
 * Um evento agrupa vários torneios (divisões/categorias) que podem estar em
 * estados diferentes; para o jogador a tela é agrupada por status, então
 * reduzimos o evento a um único estado por precedência:
 *
 *   ao vivo/ativo  >  inscrições abertas  >  encerrado  >  rascunho
 *
 * Evento sem divisões → rascunho (ainda sendo montado).
 */
export function deriveEventStatus(
  divisionStatuses: TournamentStatus[],
  hasLiveMatch: boolean,
): TournamentStatus {
  if (hasLiveMatch || divisionStatuses.some((s) => s === "active")) return "active";
  if (divisionStatuses.some((s) => s === "registration")) return "registration";
  if (divisionStatuses.some((s) => s === "finished")) return "finished";
  return "draft";
}
