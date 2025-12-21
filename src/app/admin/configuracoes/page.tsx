"use client";

import { AppShell } from "@/components/app-shell";
import { useState, useEffect } from "react";
import { Loader2, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  adminGetSettings,
  adminUpdateSetting,
  type AdminSetting,
} from "@/app/actions/admin";

const settingLabels: Record<string, { label: string; description: string }> = {
  pontos_vitoria: {
    label: "Pontos por Vitoria",
    description: "Quantidade de pontos ganhos ao vencer uma partida",
  },
  pontos_derrota: {
    label: "Pontos por Derrota",
    description: "Quantidade de pontos ganhos ao perder uma partida",
  },
  limite_jogos_diarios: {
    label: "Limite de Jogos Diarios",
    description: "Maximo de partidas por dia contra o mesmo adversario",
  },
  rating_inicial: {
    label: "Rating Inicial",
    description: "Pontuacao inicial para novos jogadores",
  },
};

export default function AdminConfiguracoesPage() {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  // Modal de confirmacao
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    key: string;
    oldValue: string;
    newValue: string;
  }>({ isOpen: false, key: "", oldValue: "", newValue: "" });

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await adminGetSettings();
      setSettings(data);
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const validateField = (value: string): string | null => {
    if (!value.trim()) {
      return "Valor nao pode ser vazio";
    }
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return "Valor deve ser um numero";
    }
    if (num < 0) {
      return "Valor deve ser maior ou igual a zero";
    }
    if (num > 10000) {
      return "Valor deve ser menor que 10.000";
    }
    return null;
  };

  const handleStartEdit = (setting: AdminSetting) => {
    setEditingKey(setting.key);
    setEditValue(setting.value);
    setFieldError("");
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
    setFieldError("");
  };

  const handleValueChange = (value: string) => {
    setEditValue(value);
    const error = validateField(value);
    setFieldError(error || "");
  };

  const handleSaveClick = (key: string) => {
    const error = validateField(editValue);
    if (error) {
      setFieldError(error);
      return;
    }

    const currentSetting = settings.find((s) => s.key === key);
    if (!currentSetting) return;

    // Se o valor nao mudou, apenas cancela a edicao
    if (currentSetting.value === editValue) {
      handleCancelEdit();
      return;
    }

    // Abre modal de confirmacao
    setConfirmModal({
      isOpen: true,
      key,
      oldValue: currentSetting.value,
      newValue: editValue,
    });
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      await adminUpdateSetting(confirmModal.key, confirmModal.newValue);
      setEditingKey(null);
      setEditValue("");
      setFieldError("");
      setSuccess("Configuracao atualizada com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
      loadSettings();
    } catch {
      setFieldError("Erro ao salvar configuracao");
    } finally {
      setSaving(false);
      setConfirmModal({ isOpen: false, key: "", oldValue: "", newValue: "" });
    }
  };

  const getSettingLabel = (key: string) => {
    return settingLabels[key]?.label || key;
  };

  return (
    <AppShell title="Configuracoes" subtitle="Regras do sistema" showBack>
      <div className="space-y-4">
        {/* Sucesso */}
        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600">
            <Check className="h-4 w-4" />
            {success}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {settings.map((setting) => {
              const meta = settingLabels[setting.key] || {
                label: setting.key,
                description: setting.description || "",
              };
              const isEditing = editingKey === setting.key;

              return (
                <div
                  key={setting.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {meta.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => handleValueChange(e.target.value)}
                              className={fieldError ? "border-red-500" : ""}
                              autoFocus
                            />
                            {/* Erro de validacao abaixo do campo */}
                            {fieldError && (
                              <p className="mt-1 text-xs text-red-500">
                                {fieldError}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                            disabled={saving}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveClick(setting.key)}
                            disabled={saving || !!fieldError}
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-primary">
                          {setting.value}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEdit(setting)}
                        >
                          Editar
                        </Button>
                      </div>
                    )}
                  </div>

                  {setting.updated_at && (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Atualizado em:{" "}
                      {new Date(setting.updated_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de confirmacao */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({ isOpen: false, key: "", oldValue: "", newValue: "" })
        }
        onConfirm={handleConfirmSave}
        title="Confirmar alteracao"
        description={`Deseja alterar "${getSettingLabel(confirmModal.key)}" de ${confirmModal.oldValue} para ${confirmModal.newValue}? Esta alteracao afetara todas as partidas futuras.`}
        confirmText="Salvar alteracao"
        cancelText="Cancelar"
        variant="warning"
        loading={saving}
      />
    </AppShell>
  );
}
