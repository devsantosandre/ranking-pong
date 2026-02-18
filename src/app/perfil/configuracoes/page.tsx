"use client";

import { changePassword } from "@/app/actions/profile";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-store";
import { usePushSubscription } from "@/lib/hooks/use-push-subscription";
import {
  AlertTriangle,
  BellOff,
  BellRing,
  Check,
  Eye,
  EyeOff,
  Key,
  Loader2,
  RefreshCcw,
} from "lucide-react";
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
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Preencha todos os campos");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Nova senha deve ter no minimo 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Senhas nao conferem");
      return;
    }

    setPasswordLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        setPasswordSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          setShowPasswordForm(false);
          setPasswordSuccess(false);
        }, 2000);
      } else {
        setPasswordError(result.error || "Erro ao alterar senha");
      }
    } catch {
      setPasswordError("Erro ao alterar senha");
    } finally {
      setPasswordLoading(false);
    }
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

        <div className="space-y-3">
          <p className="px-1 text-sm font-semibold text-foreground">Seguranca</p>

          {!showPasswordForm ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowPasswordForm(true)}
            >
              <Key className="mr-2 h-4 w-4" />
              Alterar Senha
            </Button>
          ) : (
            <article className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Alterar Senha</p>
                <button
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordError("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>

              {passwordSuccess ? (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  Senha alterada com sucesso!
                </div>
              ) : null}

              {passwordError ? (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  {passwordError}
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="Senha atual"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Nova senha"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <Input
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleChangePassword}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Key className="mr-2 h-4 w-4" />
                )}
                Confirmar Alteracao
              </Button>
            </article>
          )}
        </div>
      </div>
    </AppShell>
  );
}
