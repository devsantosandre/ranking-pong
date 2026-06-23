"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { useState, useEffect } from "react";
import { Loader2, Save, Check, TrendingUp, Clock, Trophy, Medal } from "lucide-react";
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

type SettingType = "number" | "boolean";

interface SettingMeta {
  label: string;
  description: string;
  type: SettingType;
  min?: number;
  max?: number;
  /** sufixo exibido junto ao valor (ex.: "h") */
  unit?: string;
  /** dica curta abaixo do campo em edição */
  help?: string;
}

// Fonte única da verdade: rótulo, descrição, tipo e limites de cada configuração.
const settingMeta: Record<string, SettingMeta> = {
  k_factor: {
    label: "Fator K (ELO)",
    description: "Intensidade das mudanças de pontuação a cada partida.",
    type: "number",
    min: 1,
    max: 100,
    help: "Entre 1 e 100. O intervalo 16–32 é o recomendado.",
  },
  rating_inicial: {
    label: "Rating inicial",
    description: "Pontuação com que novos jogadores entram no ranking.",
    type: "number",
    min: 0,
    max: 10000,
    help: "Entre 0 e 10.000.",
  },
  limite_jogos_diarios: {
    label: "Limite de jogos diários",
    description: "Máximo de partidas por dia contra o mesmo adversário.",
    type: "number",
    min: 1,
    max: 50,
    help: "Pelo menos 1, no máximo 50.",
  },
  pending_confirmation_deadline_hours: {
    label: "Prazo de confirmação automática",
    description:
      "Sem resposta nesse prazo, o sistema confirma a partida automaticamente com o placar atual.",
    type: "number",
    min: 1,
    max: 168,
    unit: "h",
    help: "Prazo em horas. Entre 1h e 168h (7 dias).",
  },
  season_points_win: {
    label: "Pontos por vitória",
    description: "Pontos de temporada ganhos ao vencer uma partida.",
    type: "number",
    min: 0,
    max: 100,
    help: "Padrão: 3.",
  },
  season_points_loss: {
    label: "Pontos por derrota",
    description: "Pontos de temporada ao perder (nunca negativo).",
    type: "number",
    min: 0,
    max: 100,
    help: "Padrão: 1.",
  },
  season_zebra_enabled: {
    label: "Habilitar bônus de zebra",
    description: "Liga ou desliga o bônus por vencer alguém mais bem ranqueado.",
    type: "boolean",
  },
  season_zebra_bonus: {
    label: "Bônus de zebra",
    description: "Pontos extras ao vencer alguém com rating Geral maior.",
    type: "number",
    min: 0,
    max: 100,
    help: "Padrão: 2. Só vale quando o bônus está habilitado.",
  },
  achievements_rating_min_players: {
    label: "Conquistas de rating — mín. jogadores",
    description:
      "Mínimo de jogadores com jogo validado para liberar as conquistas de rating.",
    type: "number",
    min: 1,
    max: 10000,
  },
  achievements_rating_min_validated_matches: {
    label: "Conquistas de rating — mín. partidas",
    description: "Mínimo de partidas validadas no sistema para liberar as conquistas de rating.",
    type: "number",
    min: 0,
    max: 10000,
  },
};

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keys: string[];
}

const settingSections: SettingSection[] = [
  {
    id: "ranking",
    title: "Ranking & ELO",
    description: "Como a pontuação geral é calculada.",
    icon: TrendingUp,
    keys: ["k_factor", "rating_inicial"],
  },
  {
    id: "partidas",
    title: "Partidas & confirmação",
    description: "Regras de registro e validação dos jogos.",
    icon: Clock,
    keys: ["limite_jogos_diarios", "pending_confirmation_deadline_hours"],
  },
  {
    id: "temporada",
    title: "Temporada",
    description: "Pontuação da temporada corrente.",
    icon: Trophy,
    keys: ["season_points_win", "season_points_loss", "season_zebra_enabled", "season_zebra_bonus"],
  },
  {
    id: "conquistas",
    title: "Conquistas",
    description: "Pré-requisitos para liberar as conquistas de rating.",
    icon: Medal,
    keys: ["achievements_rating_min_players", "achievements_rating_min_validated_matches"],
  },
];

function isSupportedSettingKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(settingMeta, key);
}

/** Valor formatado para exibição (Sim/Não em booleanos, sufixo de unidade em números). */
function formatDisplayValue(key: string, value: string): string {
  const meta = settingMeta[key];
  if (!meta) return value;
  if (meta.type === "boolean") return value === "true" ? "Sim" : "Não";
  return `${value}${meta.unit ?? ""}`;
}

// Componente de preview da tabela ELO
function EloPreview({ kFactor }: { kFactor: number }) {
  if (isNaN(kFactor) || kFactor < 1) return null;

  const vsStrongerWin = calculateElo(800, 1200, kFactor);
  const vsStrongerLose = calculateElo(1200, 800, kFactor);
  const vsEqual = calculateElo(1000, 1000, kFactor);
  const vsWeakerWin = calculateElo(1200, 800, kFactor);
  const vsWeakerLose = calculateElo(800, 1200, kFactor);

  const win = { color: "var(--state-played)" };
  const lose = { color: "var(--state-noshow)" };

  return (
    <div className="mt-4 rounded-xl p-3" style={{ background: "color-mix(in srgb, var(--arena-foreground) 4%, transparent)", border: "1px solid var(--glass-border)" }}>
      <p className="text-xs font-semibold text-(--arena-muted) mb-2">
        Distribuição de pontos (K={kFactor})
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <th className="text-left py-1 font-medium text-(--arena-muted)">Situação</th>
            <th className="text-center py-1 font-medium" style={win}>Vitória</th>
            <th className="text-center py-1 font-medium" style={lose}>Derrota</th>
          </tr>
        </thead>
        <tbody className="text-(--arena-muted)">
          <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <td className="py-1.5">vs Mais forte</td>
            <td className="text-center py-1.5 font-semibold" style={win}>+{vsStrongerWin.winnerDelta}</td>
            <td className="text-center py-1.5 font-semibold" style={lose}>{vsStrongerLose.loserDelta}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <td className="py-1.5">vs Mesmo nível</td>
            <td className="text-center py-1.5 font-semibold" style={win}>+{vsEqual.winnerDelta}</td>
            <td className="text-center py-1.5 font-semibold" style={lose}>{vsEqual.loserDelta}</td>
          </tr>
          <tr>
            <td className="py-1.5">vs Mais fraco</td>
            <td className="text-center py-1.5 font-semibold" style={win}>+{vsWeakerWin.winnerDelta}</td>
            <td className="text-center py-1.5 font-semibold" style={lose}>{vsWeakerLose.loserDelta}</td>
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

  const validateField = (value: string, key?: string | null): string | null => {
    if (!key || !isSupportedSettingKey(key)) return null;
    const meta = settingMeta[key];
    const trimmed = value.trim();
    if (!trimmed) return "O valor não pode ficar vazio.";

    if (meta.type === "boolean") {
      return trimmed === "true" || trimmed === "false" ? null : "Selecione Sim ou Não.";
    }

    if (!/^\d+$/.test(trimmed)) return "Informe um número inteiro válido.";
    const num = parseInt(trimmed, 10);
    if (meta.min != null && num < meta.min) {
      return `O mínimo permitido é ${meta.min}${meta.unit ?? ""}.`;
    }
    if (meta.max != null && num > meta.max) {
      return `O máximo permitido é ${meta.max}${meta.unit ?? ""}.`;
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
    const error = validateField(value, editingKey);
    setFieldError(error || "");
  };

  const handleSaveClick = (key: string) => {
    const error = validateField(editValue, key);
    if (error) {
      setFieldError(error);
      return;
    }

    const currentSetting = settings.find((s) => s.key === key);
    if (!currentSetting) return;

    if (currentSetting.value === editValue) {
      handleCancelEdit();
      return;
    }

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
      setSuccess("Configuração atualizada com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
      loadSettings();
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Erro ao salvar configuração");
    } finally {
      setSaving(false);
      setConfirmModal({ isOpen: false, key: "", oldValue: "", newValue: "" });
    }
  };

  const getSettingLabel = (key: string) =>
    isSupportedSettingKey(key) ? settingMeta[key].label : key;

  const settingsByKey = new Map(settings.map((s) => [s.key, s]));
  const zebraEnabled = settingsByKey.get("season_zebra_enabled")?.value === "true";

  const renderSettingCard = (setting: AdminSetting) => {
    const meta = settingMeta[setting.key];
    const isEditing = editingKey === setting.key;
    const isBoolean = meta.type === "boolean";
    const bonusDisabled = setting.key === "season_zebra_bonus" && !zebraEnabled;

    return (
      <GlassCard key={setting.id}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="font-semibold text-(--arena-foreground)">{meta.label}</p>
            <p className="text-xs text-(--arena-muted)">{meta.description}</p>
          </div>
        </div>

        <div className="mt-3">
          {isEditing ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  {isBoolean ? (
                    <select
                      className="h-9 w-full rounded-md px-3 text-sm text-(--arena-foreground) outline-none"
                      style={{
                        background: "var(--arena-bg-2)",
                        border: `1px solid ${fieldError ? "var(--state-noshow)" : "var(--glass-border)"}`,
                      }}
                      value={editValue}
                      onChange={(e) => handleValueChange(e.target.value)}
                      autoFocus
                    >
                      <option value="true">Sim (ativado)</option>
                      <option value="false">Não (desativado)</option>
                    </select>
                  ) : (
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={editValue}
                      onChange={(e) => handleValueChange(e.target.value)}
                      style={fieldError ? { borderColor: "var(--state-noshow)" } : undefined}
                      autoFocus
                    />
                  )}
                  {meta.help && !fieldError && (
                    <p className="mt-1 text-xs text-(--arena-muted)">{meta.help}</p>
                  )}
                  {fieldError && (
                    <p className="mt-1 text-xs" style={{ color: "var(--state-noshow)" }}>
                      {fieldError}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={handleCancelEdit} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSaveClick(setting.key)}
                  disabled={saving || !!fieldError}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              {isBoolean ? (
                <span
                  className="rounded-full px-3 py-1 text-sm font-bold"
                  style={{
                    background: `color-mix(in srgb, ${setting.value === "true" ? "var(--state-played)" : "var(--state-tbd)"} 14%, transparent)`,
                    color: setting.value === "true" ? "var(--state-played)" : "var(--state-tbd)",
                  }}
                >
                  {formatDisplayValue(setting.key, setting.value)}
                </span>
              ) : (
                <p className="text-2xl font-bold text-(--arena-primary) tabular-nums">
                  {formatDisplayValue(setting.key, setting.value)}
                </p>
              )}
              <Button size="sm" variant="outline" onClick={() => handleStartEdit(setting)}>
                Editar
              </Button>
            </div>
          )}
        </div>

        {bonusDisabled && !isEditing && (
          <p className="mt-2 text-[11px] text-(--state-scheduled)">
            O bônus de zebra está desativado — este valor não está sendo aplicado.
          </p>
        )}

        {setting.updated_at && (
          <p className="mt-2 text-[10px] text-(--arena-muted)">
            Atualizado em: {new Date(setting.updated_at).toLocaleDateString("pt-BR")}
          </p>
        )}

        {setting.key === "k_factor" && (
          <EloPreview kFactor={isEditing ? parseInt(editValue, 10) || 24 : parseInt(setting.value, 10)} />
        )}
      </GlassCard>
    );
  };

  return (
    <ArenaShell title="Configurações" subtitle="Regras do sistema" showBack>
      <div className="flex flex-col gap-6">
        {success && (
          <div
            className="flex items-center gap-2 rounded-lg p-3 text-sm"
            style={{ background: "color-mix(in srgb, var(--state-played) 12%, transparent)", color: "var(--state-played)" }}
          >
            <Check className="h-4 w-4" />
            {success}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-(--arena-primary)" />
          </div>
        ) : (
          settingSections.map((section) => {
            const sectionSettings = section.keys
              .map((key) => settingsByKey.get(key))
              .filter((s): s is AdminSetting => !!s);

            if (sectionSettings.length === 0) return null;

            const Icon = section.icon;
            return (
              <section key={section.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5 px-1">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "color-mix(in srgb, var(--arena-primary) 14%, transparent)" }}
                  >
                    <Icon className="h-5 w-5 text-(--arena-primary)" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-(--arena-foreground)">{section.title}</p>
                    <p className="text-[11px] text-(--arena-muted)">{section.description}</p>
                  </div>
                </div>
                {sectionSettings.map(renderSettingCard)}
              </section>
            );
          })
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, key: "", oldValue: "", newValue: "" })}
        onConfirm={handleConfirmSave}
        title="Confirmar alteração"
        description={`Deseja alterar "${getSettingLabel(confirmModal.key)}" de ${formatDisplayValue(confirmModal.key, confirmModal.oldValue)} para ${formatDisplayValue(confirmModal.key, confirmModal.newValue)}? ${
          confirmModal.key === "pending_confirmation_deadline_hours"
            ? "Esta alteração afeta as pendências abertas e os próximos registros."
            : "Esta alteração afetará as próximas partidas."
        }`}
        confirmText="Salvar alteração"
        cancelText="Cancelar"
        variant="warning"
        loading={saving}
      />
    </ArenaShell>
  );
}
