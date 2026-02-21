"use client";

import { AppShell } from "@/components/app-shell";
import { useState, useEffect } from "react";
import { Loader2, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries";
import { calculateElo } from "@/lib/elo";
import {
  adminGetSettings,
  adminUpdateSetting,
  type AdminSetting,
} from "@/app/actions/admin";

const settingLabels: Record<string, { label: string; description: string }> = {
  k_factor: {
    label: "Fator K (ELO)",
    description: "Intensidade das mudancas de pontuacao (16-32 recomendado)",
  },
  limite_jogos_diarios: {
    label: "Limite de Jogos Diarios",
    description: "Maximo de partidas por dia contra o mesmo adversario",
  },
  rating_inicial: {
    label: "Rating Inicial",
    description: "Pontuacao inicial para novos jogadores",
  },
  achievements_rating_min_players: {
    label: "Conquistas Rating: Min. Jogadores",
    description: "Minimo de jogadores com jogo validado para liberar conquistas de rating",
  },
  achievements_rating_min_validated_matches: {
    label: "Conquistas Rating: Min. Partidas",
    description: "Minimo de partidas validadas globais para liberar conquistas de rating",
  },
};

const settingDisplayOrder = [
  "k_factor",
  "limite_jogos_diarios",
  "rating_inicial",
  "achievements_rating_min_players",
  "achievements_rating_min_validated_matches",
] as const;

const settingOrderIndex = new Map(settingDisplayOrder.map((key, index) => [key, index]));

// Componente de preview da tabela ELO
function EloPreview({ kFactor }: { kFactor: number }) {
  if (isNaN(kFactor) || kFactor < 1) return null;

  // Calcular exemplos
  const vsStrongerWin = calculateElo(800, 1200, kFactor);
  const vsStrongerLose = calculateElo(1200, 800, kFactor);
  const vsEqual = calculateElo(1000, 1000, kFactor);
  const vsWeakerWin = calculateElo(1200, 800, kFactor);
  const vsWeakerLose = calculateElo(800, 1200, kFactor);

  return (
    <div className="mt-4 rounded-xl border border-border/50 bg-muted/30 p-3">
      <p className="text-xs font-semibold text-muted-foreground mb-2">
        Distribuicao de pontos (K={kFactor})
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-1 font-medium text-muted-foreground">Situacao</th>
            <th className="text-center py-1 font-medium text-green-600">Vitoria</th>
            <th className="text-center py-1 font-medium text-red-500">Derrota</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          <tr className="border-b border-border/30">
            <td className="py-1.5">vs Mais forte</td>
            <td className="text-center py-1.5 text-green-600 font-semibold">+{vsStrongerWin.winnerDelta}</td>
            <td className="text-center py-1.5 text-red-500 font-semibold">{vsStrongerLose.loserDelta}</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-1.5">vs Mesmo nivel</td>
            <td className="text-center py-1.5 text-green-600 font-semibold">+{vsEqual.winnerDelta}</td>
            <td className="text-center py-1.5 text-red-500 font-semibold">{vsEqual.loserDelta}</td>
          </tr>
          <tr>
            <td className="py-1.5">vs Mais fraco</td>
            <td className="text-center py-1.5 text-green-600 font-semibold">+{vsWeakerWin.winnerDelta}</td>
            <td className="text-center py-1.5 text-red-500 font-semibold">{vsWeakerLose.loserDelta}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function AdminConfiguracoesPage() {
  const queryClient = useQueryClient();
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
      // Invalidar cache para atualizar outras paginas (ex: /regras)
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      setFieldError("Erro ao salvar configuracao");
    } finally {
      setSaving(false);
      setConfirmModal({ isOpen: false, key: "", oldValue: "", newValue: "" });
    }
  };

  const orderedSettings = [...settings]
    .filter((setting) => settingLabels[setting.key])
    .sort((left, right) => {
      const leftIndex = settingOrderIndex.get(left.key) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = settingOrderIndex.get(right.key) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });

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
            {orderedSettings.map((setting) => {
              const meta = settingLabels[setting.key];
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

                  {/* Preview da tabela ELO para k_factor */}
                  {setting.key === "k_factor" && (
                    <EloPreview kFactor={isEditing ? parseInt(editValue, 10) || 24 : parseInt(setting.value, 10)} />
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
