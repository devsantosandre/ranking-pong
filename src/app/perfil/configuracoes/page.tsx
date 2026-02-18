"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import { usePushSubscription } from "@/lib/hooks/use-push-subscription";
import { BellOff, BellRing, Loader2, RefreshCcw } from "lucide-react";
import { useMemo, useState } from "react";

export default function PerfilConfiguracoesPage() {
  const { user, loading, canAccessAdmin } = useAuth();
  const {
    clearSoftAskDismissal,
    hasSubscription,
    isConfigured,
    isRequestingPermission,
    isSupported,
    isSyncing,
    permission,
    requestPermissionAndSubscribe,
    syncSubscription,
  } = usePushSubscription();
  const [feedback, setFeedback] = useState("");

  const pushStatus = useMemo(() => {
    if (!isConfigured) {
      return {
        label: "Indisponível",
        badgeClass: "border-yellow-200 bg-yellow-50 text-yellow-700",
        description: "Notificações ainda não foram habilitadas no servidor.",
      };
    }

    if (!isSupported) {
      return {
        label: "Não suportado",
        badgeClass: "border-yellow-200 bg-yellow-50 text-yellow-700",
        description: "Este dispositivo ou navegador não suporta notificações push.",
      };
    }

    if (permission === "denied") {
      return {
        label: "Bloqueado",
        badgeClass: "border-red-200 bg-red-50 text-red-700",
        description: "Você bloqueou notificações. Libere nas configurações do navegador.",
      };
    }

    if (permission === "granted" && hasSubscription) {
      return {
        label: "Ativo",
        badgeClass: "border-green-200 bg-green-50 text-green-700",
        description: "Seu dispositivo está pronto para receber alertas.",
      };
    }

    if (permission === "granted" && !hasSubscription) {
      return {
        label: "Sincronizando",
        badgeClass: "border-yellow-200 bg-yellow-50 text-yellow-700",
        description: "Permissão concedida. Estamos finalizando o vínculo do dispositivo.",
      };
    }

    return {
      label: "Inativo",
      badgeClass: "border-border bg-muted/40 text-muted-foreground",
      description: "Ative para receber alertas de pendência de partida.",
    };
  }, [hasSubscription, isConfigured, isSupported, permission]);

  const permissionLabel = useMemo(() => {
    if (!isSupported) return "Indisponível";
    if (permission === "granted") return "Permitida";
    if (permission === "denied") return "Bloqueada";
    return "Não definida";
  }, [isSupported, permission]);

  const handleEnablePush = async () => {
    setFeedback("");
    const result = await requestPermissionAndSubscribe();

    if (result.ok) {
      setFeedback("Notificações ativadas com sucesso.");
      return;
    }

    const reasonMessageMap: Record<string, string> = {
      misconfigured: "Ainda indisponível no servidor. Tente novamente mais tarde.",
      unsupported: "Seu dispositivo não suporta notificações push.",
      permission_denied: "Permissão bloqueada. Libere nas configurações do navegador.",
      permission_not_granted: "Permissão não concedida.",
      subscribe_failed: "Não foi possível ativar agora. Tente novamente.",
      not_authenticated: "Sessão inválida. Faça login novamente.",
    };

    setFeedback(reasonMessageMap[result.reason || "subscribe_failed"]);
  };

  const handleVerifyPush = async () => {
    setFeedback("");
    await syncSubscription();
    setFeedback("Status atualizado.");
  };

  const handleShowReminder = () => {
    clearSoftAskDismissal();
    setFeedback("Lembrete de ativação reativado no app.");
  };

  if (loading) {
    return (
      <AppShell title="Configurações" subtitle="Preferências do app" showBack>
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="Configurações" subtitle="Preferências do app" showBack>
        <p className="py-8 text-center text-sm text-muted-foreground">
          Faça login para acessar configurações
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Configurações" subtitle="Preferências do app" showBack>
      <div className="space-y-4">
        <article className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              {pushStatus.label === "Ativo" ? (
                <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Notificações push</p>
                <p className="text-xs text-muted-foreground">{pushStatus.description}</p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${pushStatus.badgeClass}`}
            >
              {pushStatus.label}
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Permissão: <span className="font-medium">{permissionLabel}</span> • Dispositivo:
            <span className="font-medium"> {hasSubscription ? " conectado" : " não conectado"}</span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {isConfigured && isSupported && permission !== "granted" ? (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={isRequestingPermission}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isRequestingPermission ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Ativando...
                  </>
                ) : (
                  "Ativar notificações"
                )}
              </button>
            ) : null}

            {isConfigured && isSupported ? (
              <button
                type="button"
                onClick={handleVerifyPush}
                disabled={isSyncing}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-3 w-3" />
                    Atualizar status
                  </>
                )}
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleShowReminder}
              className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              Mostrar lembrete no app
            </button>
          </div>

          {feedback ? <p className="text-xs text-muted-foreground">{feedback}</p> : null}

          {!isConfigured && canAccessAdmin ? (
            <p className="text-xs text-muted-foreground">
              Para resolver: configure no servidor as variáveis `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
              `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`.
            </p>
          ) : null}
        </article>
      </div>
    </AppShell>
  );
}
