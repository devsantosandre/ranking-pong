"use client";

import { rarityColors, type Achievement } from "@/lib/queries/use-achievements";
import { getSingleEmoji } from "@/lib/emoji";

type AchievementBadgeProps = {
  achievement: Achievement;
  unlocked?: boolean;
  unlockedAt?: string;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
};

export function AchievementBadge({
  achievement,
  unlocked = false,
  unlockedAt,
  size = "md",
  showTooltip = true,
}: AchievementBadgeProps) {
  const colors = rarityColors[achievement.rarity] || rarityColors.bronze;
  const icon = getSingleEmoji(achievement.icon);

  const sizeClasses = {
    sm: "h-10 w-10 text-lg",
    md: "h-14 w-14 text-2xl",
    lg: "h-20 w-20 text-4xl",
  };

  const badgeSize = sizeClasses[size];

  return (
    <div className="group relative flex flex-col items-center">
      {/* Badge */}
      <div
        className={`
          flex items-center justify-center rounded-xl border-2 shadow-sm
          transition-all duration-200
          ${badgeSize}
          ${
            unlocked
              ? `${colors.bg} ${colors.border} ${colors.text}`
              : "bg-muted/50 border-muted-foreground/20 text-muted-foreground/40"
          }
          ${unlocked ? "hover:scale-105 hover:shadow-md" : ""}
        `}
      >
        {unlocked ? (
          <span>{icon}</span>
        ) : (
          <span className="text-muted-foreground/30">?</span>
        )}
      </div>

      {/* Nome (para tamanhos maiores) */}
      {size !== "sm" && (
        <p
          className={`mt-1 text-center text-[10px] font-medium leading-tight max-w-[60px] truncate ${
            unlocked ? "text-foreground" : "text-muted-foreground/50"
          }`}
        >
          {unlocked ? achievement.name : "???"}
        </p>
      )}

      {/* Tooltip - aparece abaixo para não ser cortado */}
      {showTooltip && (
        <div
          className={`
            absolute top-full left-1/2 z-[100] -translate-x-1/2 mt-2
            opacity-0 group-hover:opacity-100 transition-opacity duration-200
            pointer-events-none
          `}
        >
          {/* Seta apontando para cima */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-popover" />
          <div className="bg-popover text-popover-foreground rounded-lg border shadow-lg p-2 min-w-[140px] max-w-[180px]">
            <p className="font-semibold text-xs flex items-center gap-1">
              {icon} {achievement.name}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {achievement.description}
            </p>
            {unlocked && unlockedAt && (
              <p className="text-[9px] text-muted-foreground mt-1 border-t pt-1">
                Desbloqueada em {new Date(unlockedAt).toLocaleDateString("pt-BR")}
              </p>
            )}
            {!unlocked && (
              <p className="text-[9px] text-amber-600 mt-1 border-t pt-1 font-medium">
                Bloqueada
              </p>
            )}
            <span
              className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${colors.bg} ${colors.text}`}
            >
              {achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Badge compacto para listas
export function AchievementBadgeCompact({
  achievement,
  unlocked = false,
}: {
  achievement: Achievement;
  unlocked?: boolean;
}) {
  const colors = rarityColors[achievement.rarity] || rarityColors.bronze;
  const icon = getSingleEmoji(achievement.icon);

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
        ${unlocked ? `${colors.bg} ${colors.text}` : "bg-muted text-muted-foreground"}
      `}
    >
      <span>{unlocked ? icon : "?"}</span>
      <span>{unlocked ? achievement.name : "???"}</span>
    </div>
  );
}
