"use client";

import { AppShell } from "@/components/app-shell";
import { useState, useEffect } from "react";
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
  user_rating_changed: { label: "Pontos alterados", color: "bg-purple-100 text-purple-700" },
  user_role_changed: { label: "Role alterado", color: "bg-indigo-100 text-indigo-700" },
  match_cancelled: { label: "Partida cancelada", color: "bg-red-100 text-red-700" },
  setting_changed: { label: "Config alterada", color: "bg-amber-100 text-amber-700" },
};

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

  const loadLogs = async (reset = true) => {
    if (reset) {
      setLoading(true);
      setPage(0);
    } else {
      setLoadingMore(true);
    }
    try {
      const currentPage = reset ? 0 : page;
      const result = await adminGetLogs(currentPage);
      if (reset) {
        setLogs(result.logs);
      } else {
        setLogs((prev) => [...prev, ...result.logs]);
      }
      setHasMore(result.hasMore);
      if (!reset) {
        setPage((p) => p + 1);
      } else {
        setPage(1);
      }
    } catch {
      setError("Erro ao carregar historico");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadLogs(true);
  }, []);

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
                label: log.action,
                color: "bg-gray-100 text-gray-700",
              };
              const TargetIcon = targetIcons[log.target_type] || User;
              const isExpanded = expandedLog === log.id;

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
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${actionMeta.color}`}
                      >
                        <TargetIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${actionMeta.color}`}
                        >
                          {actionMeta.label}
                        </span>
                        <p className="mt-1 text-sm font-medium">
                          {log.action_description}
                        </p>
                        {log.target_name && (
                          <p className="text-xs text-muted-foreground">
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
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Detalhes expandidos */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
                      <div className="text-xs">
                        <span className="text-muted-foreground">Admin: </span>
                        <span className="font-medium">
                          {log.admin?.full_name || log.admin?.name || "Desconhecido"}
                        </span>
                        <span className="ml-1 text-muted-foreground">
                          ({log.admin_role})
                        </span>
                      </div>

                      {log.reason && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Motivo: </span>
                          <span className="font-medium">{log.reason}</span>
                        </div>
                      )}

                      {log.old_value && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Antes: </span>
                          <div className="mt-1 max-w-full overflow-x-auto">
                            <code className="inline-block min-w-full rounded bg-muted px-2 py-1 text-[10px] whitespace-nowrap">
                              {JSON.stringify(log.old_value)}
                            </code>
                          </div>
                        </div>
                      )}

                      {log.new_value && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Depois: </span>
                          <div className="mt-1 max-w-full overflow-x-auto">
                            <code className="inline-block min-w-full rounded bg-muted px-2 py-1 text-[10px] whitespace-nowrap">
                              {JSON.stringify(log.new_value)}
                            </code>
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
              onClick={() => loadLogs(false)}
              isLoading={loadingMore}
              hasMore={hasMore}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
