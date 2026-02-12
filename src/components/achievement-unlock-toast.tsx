"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight } from "lucide-react";
import { rarityColors, type Achievement } from "@/lib/queries/use-achievements";

// ⚠️ PREVIEW MODE - Remover após ajustes
const PREVIEW_MODE = false;
const PREVIEW_ACHIEVEMENTS: Achievement[] = [
  {
    id: "preview-1",
    key: "first_win",
    name: "Primeira Vitória",
    description: "Vença sua primeira partida no ranking",
    category: "primeiros_passos",
    rarity: "ouro",
    icon: "🏆",
    points: 10,
    condition_type: "wins",
    condition_value: 1,
    is_active: true,
  },
  {
    id: "preview-2",
    key: "winning_streak_3",
    name: "Sequência de Fogo",
    description: "Vença 3 partidas consecutivas",
    category: "sequencias",
    rarity: "prata",
    icon: "🔥",
    points: 25,
    condition_type: "streak",
    condition_value: 3,
    is_active: true,
  },
  {
    id: "preview-3",
    key: "legend",
    name: "Lenda do Ping Pong",
    description: "Alcance o rating de 1500 pontos",
    category: "rating",
    rarity: "diamante",
    icon: "💎",
    points: 100,
    condition_type: "rating",
    condition_value: 1500,
    is_active: true,
  },
];

// Raridades que mostram confete
const CONFETTI_RARITIES = ["diamante", "platina", "especial"];

type AchievementUnlockToastProps = {
  achievements: Achievement[];
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
};

// Componente de partícula de confete
function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
  return (
    <div
      className="absolute w-2 h-2 rounded-full"
      style={{
        backgroundColor: color,
        left: `${Math.random() * 100}%`,
        top: "-10px",
        animation: `confetti-fall 1.5s ease-out ${delay}ms forwards`,
        opacity: 0,
      }}
    />
  );
}

export function AchievementUnlockToast({
  achievements: propAchievements,
  onClose,
  autoClose = true,
  autoCloseDelay = 4000,
}: AchievementUnlockToastProps) {
  const achievements = PREVIEW_MODE ? PREVIEW_ACHIEVEMENTS : propAchievements;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<"enter" | "visible" | "exit">("enter");
  const [key, setKey] = useState(0); // Para forçar re-render da animação

  const achievement = achievements[currentIndex];
  const colors = rarityColors[achievement?.rarity] || rarityColors.bronze;
  const showConfetti = achievement && CONFETTI_RARITIES.includes(achievement.rarity);

  const goToNext = useCallback(() => {
    if (currentIndex < achievements.length - 1) {
      setAnimationPhase("exit");
      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setKey((k) => k + 1);
        setAnimationPhase("enter");
        setTimeout(() => setAnimationPhase("visible"), 50);
      }, 300);
    } else {
      setAnimationPhase("exit");
      setTimeout(onClose, 300);
    }
  }, [currentIndex, achievements.length, onClose]);

  // Animação de entrada inicial
  useEffect(() => {
    const timer = setTimeout(() => setAnimationPhase("visible"), 50);
    return () => clearTimeout(timer);
  }, []);

  // Auto-close timer
  useEffect(() => {
    if (autoClose && animationPhase === "visible") {
      const timer = setTimeout(goToNext, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDelay, animationPhase, goToNext, currentIndex]);

  if (achievements.length === 0 || !achievement) return null;

  const confettiColors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8"];

  return (
    <div
      className={`
        fixed bottom-24 left-1/2 -translate-x-1/2 z-[70]
        transition-all duration-300 ease-out
        ${animationPhase === "visible" ? "pointer-events-auto" : "pointer-events-none"}
      `}
    >
      {/* Container com confete */}
      <div className="relative">
        {/* Partículas de confete para raridades especiais */}
        {showConfetti && animationPhase === "visible" && (
          <div className="absolute inset-0 overflow-visible pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <ConfettiParticle
                key={`${key}-${i}`}
                delay={i * 50}
                color={confettiColors[i % confettiColors.length]}
              />
            ))}
          </div>
        )}

        {/* Card principal */}
        <div
          key={key}
          className={`
            relative overflow-hidden rounded-2xl border-2 shadow-2xl
            ${colors.border} ${colors.bg}
            min-w-[300px] max-w-[340px]
            transition-all duration-300 ease-out
            ${animationPhase === "enter" ? "opacity-0 scale-75 translate-y-8" : ""}
            ${animationPhase === "visible" ? "opacity-100 scale-100 translate-y-0" : ""}
            ${animationPhase === "exit" ? "opacity-0 scale-90 -translate-y-4" : ""}
          `}
        >
          {/* Barra de progresso */}
          {autoClose && animationPhase === "visible" && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-black/10">
              <div
                key={`progress-${key}`}
                className={`h-full ${colors.text.replace("text-", "bg-")} opacity-60`}
                style={{
                  animation: `shrink ${autoCloseDelay}ms linear forwards`,
                  width: "100%",
                }}
              />
            </div>
          )}

          {/* Glow effect para raridades especiais */}
          {showConfetti && (
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                boxShadow: `0 0 40px ${colors.border.includes("purple") ? "rgba(168, 85, 247, 0.4)" : "rgba(6, 182, 212, 0.4)"}`,
              }}
            />
          )}

          {/* Conteúdo */}
          <div className="relative p-4">
            {/* Header com ícone animado */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`
                    text-4xl
                    ${animationPhase === "visible" ? "animate-bounce" : ""}
                  `}
                  style={{
                    filter: showConfetti ? "drop-shadow(0 0 8px rgba(255,255,255,0.8))" : "none",
                  }}
                >
                  {achievement.icon}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                    Conquista Desbloqueada!
                  </p>
                  <p className={`font-bold text-lg ${colors.text}`}>
                    {achievement.name}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAnimationPhase("exit");
                  setTimeout(onClose, 300);
                }}
                className="p-1.5 hover:bg-black/10 rounded-full transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Descrição */}
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {achievement.description}
            </p>

            {/* Footer com raridade e navegação */}
            <div className="mt-4 flex items-center justify-between">
              <span
                className={`
                  px-3 py-1 rounded-full text-xs font-bold
                  ${colors.bg} ${colors.text} border-2 ${colors.border}
                  ${showConfetti ? "animate-pulse" : ""}
                `}
              >
                {achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1)}
              </span>

              {achievements.length > 1 && (
                <button
                  onClick={goToNext}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{currentIndex + 1} de {achievements.length}</span>
                  {currentIndex < achievements.length - 1 && (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>

          </div>

          {/* Efeito de brilho passando */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background:
                  "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.9) 45%, rgba(255,255,255,0.9) 55%, transparent 60%)",
                animation: "shine 2.5s ease-in-out infinite",
              }}
            />
          </div>
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
          0% {
            transform: translateX(-150%);
          }
          100% {
            transform: translateX(150%);
          }
        }
        @keyframes confetti-fall {
          0% {
            opacity: 1;
            transform: translateY(0) rotate(0deg) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(150px) rotate(720deg) scale(0.5);
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
