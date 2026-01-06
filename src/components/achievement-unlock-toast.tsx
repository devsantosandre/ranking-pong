"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { rarityColors, type Achievement } from "@/lib/queries/use-achievements";

type AchievementUnlockToastProps = {
  achievements: Achievement[];
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
};

export function AchievementUnlockToast({
  achievements,
  onClose,
  autoClose = true,
  autoCloseDelay = 5000,
}: AchievementUnlockToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Animação de entrada
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (autoClose && achievements.length > 0) {
      const timer = setTimeout(() => {
        if (currentIndex < achievements.length - 1) {
          setCurrentIndex((i) => i + 1);
        } else {
          handleClose();
        }
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDelay, currentIndex, achievements.length]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  if (achievements.length === 0) return null;

  const achievement = achievements[currentIndex];
  const colors = rarityColors[achievement.rarity] || rarityColors.bronze;

  return (
    <div
      className={`
        fixed bottom-4 left-1/2 -translate-x-1/2 z-50
        transition-all duration-300 ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
    >
      <div
        className={`
          relative overflow-hidden rounded-2xl border-2 shadow-lg
          ${colors.border} ${colors.bg}
          min-w-[280px] max-w-[320px]
        `}
      >
        {/* Barra de progresso */}
        {autoClose && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-black/10">
            <div
              className={`h-full ${colors.text.replace("text-", "bg-")} opacity-50`}
              style={{
                animation: `shrink ${autoCloseDelay}ms linear`,
                width: "100%",
              }}
            />
          </div>
        )}

        {/* Conteúdo */}
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-bounce">{achievement.icon}</span>
              <div>
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">
                  Conquista Desbloqueada!
                </p>
                <p className={`font-bold ${colors.text}`}>{achievement.name}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-black/10 rounded-full transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Descrição */}
          <p className="mt-2 text-sm text-muted-foreground">
            {achievement.description}
          </p>

          {/* Raridade */}
          <div className="mt-3 flex items-center justify-between">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}
            >
              {achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1)}
            </span>
            {achievements.length > 1 && (
              <span className="text-[10px] text-muted-foreground">
                {currentIndex + 1} de {achievements.length}
              </span>
            )}
          </div>
        </div>

        {/* Efeito de brilho */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background:
                "linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.8) 50%, transparent 60%)",
              animation: "shine 2s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        @keyframes shine {
          0%,
          100% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

// Hook para gerenciar toast de conquistas
export function useAchievementToast() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const showAchievements = (newAchievements: Achievement[]) => {
    if (newAchievements.length > 0) {
      setAchievements(newAchievements);
    }
  };

  const closeToast = () => {
    setAchievements([]);
  };

  return {
    achievements,
    showAchievements,
    closeToast,
    ToastComponent: achievements.length > 0 ? (
      <AchievementUnlockToast achievements={achievements} onClose={closeToast} />
    ) : null,
  };
}
