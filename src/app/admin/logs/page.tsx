"use client";

import { AppShell } from "@/components/app-shell";
import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  X,
  User,
  Gamepad2,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { LogListSkeleton } from "@/components/skeletons";
import { adminGetLogs, type AdminLog } from "@/app/actions/admin";

const actionLabels: Record<string, { label: string; color: string }> = {
  user_created: { label: "Jogador criado", color: "bg-green-100 text-green-700" },
  user_password_reset: { label: "Senha resetada", color: "bg-blue-100 text-blue-700" },
  user_activated: { label: "Jogador ativado", color: "bg-emerald-100 text-emerald-700" },
  user_deactivated: { label: "Jogador desativado", color: "bg-red-100 text-red-700" },
  user_stats_reset: { label: "Stats resetadas", color: "bg-orange-100 text-orange-700" },
  user_name_updated: { label: "Nome alterado", color: "bg-blue-100 text-blue-700" },
  user_rating_changed: { label: "Pontos alterados", color: "bg-purple-100 text-purple-700" },
  user_role_changed: { label: "Role alterado", color: "bg-indigo-100 text-indigo-700" },
  user_hidden_from_ranking: { label: "Jogador oculto", color: "bg-amber-100 text-amber-700" },
  user_shown_in_ranking: { label: "Jogador visível", color: "bg-emerald-100 text-emerald-700" },
  match_cancelled: { label: "Partida cancelada", color: "bg-red-100 text-red-700" },
  match_validated_by_admin: {
    label: "Partida aceita pelo admin",
    color: "bg-emerald-100 text-emerald-700",
  },
  match_auto_validated: {
    label: "Confirmação automática",
    color: "bg-cyan-100 text-cyan-700",
  },
  match_corrected_without_recalculation: {
    label: "Correção sem recálculo",
    color: "bg-amber-100 text-amber-800",
  },
  match_confirmation_overdue: {
    label: "Histórico do modelo anterior",
    color: "bg-amber-100 text-amber-700",
  },
  match_confirmation_extension_granted: {
    label: "Prorrogação do modelo anterior",
    color: "bg-sky-100 text-sky-700",
  },
  setting_changed: { label: "Config alterada", color: "bg-amber-100 text-amber-700" },
};

// Labels para configuracoes
const settingNames: Record<string, string> = {
  k_factor: "Fator K (ELO)",
  limite_jogos_diarios: "Limite jogos diarios",
  pending_confirmation_deadline_hours: "Prazo da confirmação automática",
  rating_inicial: "Rating inicial",
  achievements_rating_min_players: "Conquistas rating: min jogadores",
  achievements_rating_min_validated_matches: "Conquistas rating: min partidas",
  pontos_vitoria: "Pontos vitoria",
  pontos_derrota: "Pontos derrota",
};

function getAutoValidationDeadlineHours(log: AdminLog): number | null {
  if (log.action !== "match_auto_validated") return null;

  const candidate = log.new_value?.prazo_confirmacao_horas;
  const parsedCandidate =
    typeof candidate === "number"
      ? candidate
      : typeof candidate === "string"
        ? Number(candidate)
        : null;

  if (parsedCandidate && Number.isFinite(parsedCandidate)) {
    return parsedCandidate;
  }

  const match = log.action_description.match(/(\d+)h/);
  if (!match) return null;

  const parsedFromDescription = Number(match[1]);
  return Number.isFinite(parsedFromDescription) ? parsedFromDescription : null;
}

// Formatar valor para exibicao
function formatValue(value: unknown, action: string): React.ReactNode {
  if (value === null || value === undefined) return null;

  // Para alteracoes de configuracao
  if (action === "setting_changed" && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("key" in obj && "value" in obj) {
      const key = String(obj.key);
      const settingName = settingNames[key] || key;
      return (
        <span className="break-words [overflow-wrap:anywhere]">
          <span className="font-medium">{settingName}</span>: {String(obj.value)}
        </span>
      );
    }
  }

  // Para cancelamento de partida
  if (action === "match_cancelled" && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];

    if (obj.origem) {
      parts.push(`Origem: ${String(obj.origem)}`);
    }
    if (obj.player_a && obj.player_b) {
      parts.push(`${obj.player_a} vs ${obj.player_b}`);
    }
    if (obj.resultado_a !== undefined && obj.resultado_b !== undefined) {
      parts.push(`Placar: ${obj.resultado_a} x ${obj.resultado_b}`);
    }
    if (obj.pontos_revertidos_a !== undefined || obj.pontos_revertidos_b !== undefined) {
      const ptsA = Number(obj.pontos_revertidos_a) || 0;
      const ptsB = Number(obj.pontos_revertidos_b) || 0;
      parts.push(`Pontos revertidos: ${ptsA > 0 ? `-${ptsA}` : `+${Math.abs(ptsA)}`} / ${ptsB > 0 ? `-${ptsB}` : `+${Math.abs(ptsB)}`}`);
    }

    if (parts.length > 0) {
      return (
        <div className="space-y-0.5 break-words [overflow-wrap:anywhere]">
          {parts.map((part, i) => (
            <div key={i}>{part}</div>
          ))}
        </div>
      );
    }
  }

  if (
    (action === "match_validated_by_admin" || action === "match_auto_validated") &&
    typeof value === "object"
  ) {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];

    if (obj.origem) {
      parts.push(`Origem: ${String(obj.origem)}`);
    }
    if (action === "match_auto_validated" && obj.prazo_confirmacao_horas !== undefined) {
      parts.push(`Prazo aplicado: ${String(obj.prazo_confirmacao_horas)}h`);
    }
    if (obj.player_a && obj.player_b) {
      parts.push(`${obj.player_a} vs ${obj.player_b}`);
    }
    if (obj.placar !== undefined) {
      parts.push(`Placar: ${String(obj.placar)}`);
    }
    if (
      obj.pontos_variacao_a !== undefined &&
      obj.pontos_variacao_b !== undefined
    ) {
      const deltaA = Number(obj.pontos_variacao_a) || 0;
      const deltaB = Number(obj.pontos_variacao_b) || 0;
      parts.push(`Pontos aplicados: ${deltaA >= 0 ? "+" : ""}${deltaA} / ${deltaB >= 0 ? "+" : ""}${deltaB}`);
    }
    if (obj.status !== undefined) {
      parts.push(`Status: ${String(obj.status)}`);
    }

    if (parts.length > 0) {
      return (
        <div className="space-y-0.5 break-words [overflow-wrap:anywhere]">
          {parts.map((part, index) => (
            <div key={index}>{part}</div>
          ))}
        </div>
      );
    }
  }

  if (
    action === "match_corrected_without_recalculation" &&
    typeof value === "object"
  ) {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];

    if (obj.player_a && obj.player_b) {
      parts.push(`${obj.player_a} vs ${obj.player_b}`);
    }
    if (obj.resultado_a !== undefined && obj.resultado_b !== undefined) {
      parts.push(`Placar removido do ranking: ${obj.resultado_a} x ${obj.resultado_b}`);
    }
    if (obj.compensacao_a !== undefined && obj.compensacao_b !== undefined) {
      const deltaA = Number(obj.compensacao_a) || 0;
      const deltaB = Number(obj.compensacao_b) || 0;
      parts.push(
        `Compensação aplicada: ${deltaA >= 0 ? "+" : ""}${deltaA} / ${deltaB >= 0 ? "+" : ""}${deltaB}`
      );
    }
    if (obj.impacto_direto_partidas !== undefined) {
      parts.push(`Impacto direto estimado: ${String(obj.impacto_direto_partidas)} partida(s)`);
    }
    if (obj.impacto_em_cadeia_partidas !== undefined) {
      parts.push(`Impacto em cadeia: ${String(obj.impacto_em_cadeia_partidas)} partida(s)`);
    }
    if (obj.impacto_em_cadeia_jogadores !== undefined) {
      parts.push(`Jogadores potencialmente afetados: ${String(obj.impacto_em_cadeia_jogadores)}`);
    }
    if (obj.prazo_aplicado_em !== undefined) {
      parts.push(`Pontos originais aplicados em: ${String(obj.prazo_aplicado_em)}`);
    }

    if (parts.length > 0) {
      return (
        <div className="space-y-0.5 break-words [overflow-wrap:anywhere]">
          {parts.map((part, index) => (
            <div key={index}>{part}</div>
          ))}
        </div>
      );
    }
  }

  if (
    action === "match_confirmation_overdue" &&
    typeof value === "object"
  ) {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];

    if (obj.current_deadline_at) {
      parts.push(`Prazo anterior: ${String(obj.current_deadline_at)}`);
    }
    if (obj.responsible_user_id) {
      parts.push(`Responsável na época: ${String(obj.responsible_user_id)}`);
    }
    if (obj.escalated_at) {
      parts.push(`Registrado em: ${String(obj.escalated_at)}`);
    }

    if (parts.length > 0) {
      return (
        <div className="space-y-0.5 break-words [overflow-wrap:anywhere]">
          {parts.map((part, index) => (
            <div key={index}>{part}</div>
          ))}
        </div>
      );
    }
  }

  if (
    action === "match_confirmation_extension_granted" &&
    typeof value === "object"
  ) {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];

    if (obj.current_deadline_at) {
      parts.push(`Prazo prorrogado para: ${String(obj.current_deadline_at)}`);
    }
    if (obj.responsible_user_id) {
      parts.push(`Responsável na época: ${String(obj.responsible_user_id)}`);
    }
    if (obj.extension_count !== undefined) {
      parts.push(`Prorrogações usadas: ${String(obj.extension_count)}`);
    }

    if (parts.length > 0) {
      return (
        <div className="space-y-0.5 break-words [overflow-wrap:anywhere]">
          {parts.map((part, index) => (
            <div key={index}>{part}</div>
          ))}
        </div>
      );
    }
  }

  // Para alteracao de rating
  if (action === "user_rating_changed" && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("rating" in obj) {
      return <span className="font-semibold text-primary">{String(obj.rating)} pts</span>;
    }
  }

  // Para reset de stats
  if (action === "user_stats_reset" && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];
    if (obj.rating !== undefined) parts.push(`Rating: ${obj.rating}`);
    if (obj.vitorias !== undefined) parts.push(`V: ${obj.vitorias}`);
    if (obj.derrotas !== undefined) parts.push(`D: ${obj.derrotas}`);
    if (parts.length > 0) {
      return <span className="break-words [overflow-wrap:anywhere]">{parts.join(" | ")}</span>;
    }
  }

  // Fallback para JSON
  if (typeof value === "object") {
    return (
      <pre className="max-w-full whitespace-pre-wrap break-words rounded bg-muted px-2 py-1 text-[10px] leading-relaxed [overflow-wrap:anywhere]">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return <span className="break-words [overflow-wrap:anywhere]">{String(value)}</span>;
}

const targetIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  user: User,
  match: Gamepad2,
  setting: Settings,
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays}d`;

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const loadLogs = useCallback(async (pageToLoad: number, reset: boolean) => {
    if (reset) {
      setLoading(true);
      setPage(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const result = await adminGetLogs(pageToLoad);
      if (reset) {
        setLogs(result.logs);
      } else {
        setLogs((prev) => [...prev, ...result.logs]);
      }

      setError("");
      setHasMore(result.hasMore);

      setPage(pageToLoad + 1);
    } catch {
      setError("Erro ao carregar historico");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs(0, true);
  }, [loadLogs]);

  return (
    <AppShell title="Historico" subtitle="Acoes administrativas" showBack>
      <div className="space-y-4">
        {/* Erro */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {error}
            <button onClick={() => setError("")} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <LogListSkeleton count={6} />
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma acao registrada
          </p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const actionMeta = actionLabels[log.action] || {
                label: "Acao registrada",
                color: "bg-slate-100 text-slate-700",
              };
              const TargetIcon = targetIcons[log.target_type] || User;
              const isExpanded = expandedLog === log.id;
              const autoValidationDeadlineHours = getAutoValidationDeadlineHours(log);

              return (
                <article
                  key={log.id}
                  className="rounded-2xl border border-border bg-card shadow-sm"
                >
                  {/* Header clicavel */}
                  <button
                    onClick={() =>
                      setExpandedLog(isExpanded ? null : log.id)
                    }
                    className="flex w-full items-start justify-between p-4 text-left"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`flex h-8 w-8 min-h-8 min-w-8 shrink-0 items-center justify-center rounded-full ${actionMeta.color}`}
                      >
                        <TargetIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span
                          className={`inline-flex max-w-full rounded-full px-2 py-0.5 text-[10px] font-semibold ${actionMeta.color}`}
                        >
                          {actionMeta.label}
                        </span>
                        <p className="mt-1 text-sm font-medium break-words [overflow-wrap:anywhere]">
                          {log.action_description}
                        </p>
                        {autoValidationDeadlineHours ? (
                          <p className="mt-1 text-xs font-medium text-cyan-700">
                            Prazo aplicado: {autoValidationDeadlineHours}h sem resposta
                          </p>
                        ) : null}
                        {log.target_name && (
                          <p className="text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
                            {log.target_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatRelativeTime(log.created_at)}
                      </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                    </div>
                  </button>

                  {/* Detalhes expandidos */}
                  {isExpanded && (
                    <div className="space-y-2 overflow-hidden border-t border-border px-4 pb-4 pt-3">
                      <div className="text-xs break-words [overflow-wrap:anywhere]">
                        <span className="text-muted-foreground">Admin: </span>
                        <span className="font-medium">
                          {log.admin?.full_name ||
                            log.admin?.name ||
                            (log.admin_role === "system" ? "Sistema" : "Desconhecido")}
                        </span>
                        <span className="ml-1 text-muted-foreground">
                          ({log.admin_role})
                        </span>
                      </div>

                      {log.reason && (
                        <div className="text-xs break-words [overflow-wrap:anywhere]">
                          <span className="text-muted-foreground">Motivo: </span>
                          <span className="font-medium">{log.reason}</span>
                        </div>
                      )}

                      {log.old_value && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Antes: </span>
                          <div className="mt-1 max-w-full">
                            {formatValue(log.old_value, log.action)}
                          </div>
                        </div>
                      )}

                      {log.new_value && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Depois: </span>
                          <div className="mt-1 max-w-full">
                            {formatValue(log.new_value, log.action)}
                          </div>
                        </div>
                      )}

                      <div className="text-[10px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}

            {/* Botao Carregar mais */}
            <LoadMoreButton
              onClick={() => void loadLogs(page, false)}
              isLoading={loadingMore}
              hasMore={hasMore}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
