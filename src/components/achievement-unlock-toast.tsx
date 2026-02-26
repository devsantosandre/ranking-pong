"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight } from "lucide-react";
import {
  rarityColors,
  type Achievement,
  useMarkAchievementToastsSeen,
  usePendingAchievementToasts,
} from "@/lib/queries/use-achievements";
import { getSingleEmoji } from "@/lib/emoji";

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
const ACHIEVEMENT_TOAST_QUEUE_STORAGE_KEY = "smash-pong:achievement-toast-queue:v1";
const ACHIEVEMENT_TOAST_QUEUE_EVENT = "smash-pong:achievement-toast-queue:changed";
const ACHIEVEMENT_TOAST_QUEUE_TTL_MS = 1000 * 60 * 30; // 30 min

type AchievementUnlockToastProps = {
  achievements: Achievement[];
  onClose: () => void;
  onAchievementVisible?: (achievement: Achievement) => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
};

type PersistedAchievementToastQueue = {
  version: 1;
  createdAt: number;
  achievements: Achievement[];
};

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function dedupeAchievements(achievements: Achievement[]) {
  const seen = new Set<string>();

  return achievements.filter((achievement) => {
    const dedupeKey = `${achievement.id}:${achievement.key}`;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
}

function readAchievementToastQueue(): Achievement[] {
  if (!canUseBrowserStorage()) return [];

  try {
    const raw = localStorage.getItem(ACHIEVEMENT_TOAST_QUEUE_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as Partial<PersistedAchievementToastQueue>;
    const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
    const isFresh = createdAt > 0 && Date.now() - createdAt <= ACHIEVEMENT_TOAST_QUEUE_TTL_MS;

    if (!isFresh || !Array.isArray(parsed.achievements)) {
      localStorage.removeItem(ACHIEVEMENT_TOAST_QUEUE_STORAGE_KEY);
      return [];
    }

    return dedupeAchievements(parsed.achievements as Achievement[]);
  } catch {
    try {
      localStorage.removeItem(ACHIEVEMENT_TOAST_QUEUE_STORAGE_KEY);
    } catch {
      // noop
    }
    return [];
  }
}

function persistAchievementToastQueue(achievements: Achievement[]) {
  if (!canUseBrowserStorage()) return;

  if (achievements.length === 0) {
    localStorage.removeItem(ACHIEVEMENT_TOAST_QUEUE_STORAGE_KEY);
    return;
  }

  const payload: PersistedAchievementToastQueue = {
    version: 1,
    createdAt: Date.now(),
    achievements,
  };

  localStorage.setItem(ACHIEVEMENT_TOAST_QUEUE_STORAGE_KEY, JSON.stringify(payload));
}

function notifyAchievementToastQueueChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACHIEVEMENT_TOAST_QUEUE_EVENT));
}

export function enqueueAchievementToast(newAchievements: Achievement[]) {
  if (!newAchievements || newAchievements.length === 0) return;

  const mergedQueue = dedupeAchievements([
    ...readAchievementToastQueue(),
    ...newAchievements,
  ]);

  persistAchievementToastQueue(mergedQueue);
  notifyAchievementToastQueueChanged();
}

export function clearAchievementToastQueue() {
  persistAchievementToastQueue([]);
  notifyAchievementToastQueueChanged();
}

export function AchievementUnlockToastHost({ userId }: { userId?: string }) {
  const [localAchievements, setLocalAchievements] = useState<Achievement[]>(() =>
    readAchievementToastQueue()
  );
  const [suppressedPendingToastIds, setSuppressedPendingToastIds] = useState<string[]>([]);
  const { data: pendingToastRows = [], refetch: refetchPendingToasts } =
    usePendingAchievementToasts(userId);
  const markToastsSeenMutation = useMarkAchievementToastsSeen(userId);
  const seenPendingToastIdsRef = useRef<Set<string>>(new Set());

  const syncQueueFromStorage = useCallback(() => {
    setLocalAchievements(readAchievementToastQueue());
  }, []);

  const syncAllSources = useCallback(() => {
    syncQueueFromStorage();
    if (userId) {
      void refetchPendingToasts();
    }
  }, [refetchPendingToasts, syncQueueFromStorage, userId]);

  useEffect(() => {
    const handleQueueChanged = () => {
      syncAllSources();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== ACHIEVEMENT_TOAST_QUEUE_STORAGE_KEY) return;
      syncAllSources();
    };

    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      syncAllSources();
    };

    window.addEventListener(ACHIEVEMENT_TOAST_QUEUE_EVENT, handleQueueChanged);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener(ACHIEVEMENT_TOAST_QUEUE_EVENT, handleQueueChanged);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [syncAllSources]);

  const suppressedPendingSet = new Set(suppressedPendingToastIds);
  const visiblePendingToastRows = pendingToastRows.filter(
    (row) => !suppressedPendingSet.has(row.id)
  );
  const pendingServerAchievements = visiblePendingToastRows.map((row) => row.achievement);
  const pendingServerIds = visiblePendingToastRows.map((row) => row.id);
  const mergedAchievements = dedupeAchievements([
    ...localAchievements,
    ...pendingServerAchievements,
  ]);

  const handleAchievementVisible = useCallback(
    (achievement: Achievement) => {
      const matchingRow = visiblePendingToastRows.find(
        (row) => row.achievement.id === achievement.id
      );

      if (!matchingRow) return;
      seenPendingToastIdsRef.current.add(matchingRow.id);
    },
    [visiblePendingToastRows]
  );

  const handleClose = useCallback(() => {
    setLocalAchievements([]);
    clearAchievementToastQueue();
    if (pendingServerIds.length > 0) {
      setSuppressedPendingToastIds((prev) =>
        Array.from(new Set([...prev, ...pendingServerIds]))
      );
    }

    const idsToMarkAsSeen = Array.from(seenPendingToastIdsRef.current);
    seenPendingToastIdsRef.current.clear();

    if (idsToMarkAsSeen.length > 0) {
      markToastsSeenMutation.mutate(idsToMarkAsSeen);
    }
  }, [markToastsSeenMutation, pendingServerIds]);

  if (mergedAchievements.length === 0) return null;

  return (
    <AchievementUnlockToast
      achievements={mergedAchievements}
      onClose={handleClose}
      onAchievementVisible={handleAchievementVisible}
    />
  );
}

// Componente de partícula de confete
function ConfettiParticle({
  delay,
  color,
  leftPercent,
}: {
  delay: number;
  color: string;
  leftPercent: number;
}) {
  return (
    <div
      className="absolute w-2 h-2 rounded-full"
      style={{
        backgroundColor: color,
        left: `${leftPercent}%`,
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
  onAchievementVisible,
  autoClose = true,
  autoCloseDelay = 7000,
}: AchievementUnlockToastProps) {
  const achievements = PREVIEW_MODE ? PREVIEW_ACHIEVEMENTS : propAchievements;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<"enter" | "visible" | "exit">("enter");
  const [key, setKey] = useState(0); // Para forçar re-render da animação
  const [isDocumentVisible, setIsDocumentVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState !== "hidden"
  );
  const [progressRestartKey, setProgressRestartKey] = useState(0);
  const documentVisibleRef = useRef(isDocumentVisible);
  const animationPhaseRef = useRef(animationPhase);
  const autoCloseRef = useRef(autoClose);

  const achievement = achievements[currentIndex];
  const colors = rarityColors[achievement?.rarity] || rarityColors.bronze;
  const showConfetti = achievement && CONFETTI_RARITIES.includes(achievement.rarity);
  const icon = getSingleEmoji(achievement?.icon);

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

  // Detecta quando o app volta do background para pausar/retomar o auto-close
  useEffect(() => {
    const handleVisibilityChange = () => {
      const nextVisible = document.visibilityState !== "hidden";
      const wasVisible = documentVisibleRef.current;

      documentVisibleRef.current = nextVisible;
      setIsDocumentVisible(nextVisible);

      if (nextVisible && !wasVisible && autoCloseRef.current && animationPhaseRef.current === "visible") {
        setProgressRestartKey((v) => v + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    animationPhaseRef.current = animationPhase;
  }, [animationPhase]);

  useEffect(() => {
    autoCloseRef.current = autoClose;
  }, [autoClose]);

  useEffect(() => {
    if (!achievement || !onAchievementVisible) return;
    if (animationPhase !== "visible" || !isDocumentVisible) return;
    onAchievementVisible(achievement);
  }, [
    achievement,
    animationPhase,
    currentIndex,
    isDocumentVisible,
    onAchievementVisible,
  ]);

  // Auto-close timer
  useEffect(() => {
    if (autoClose && animationPhase === "visible" && isDocumentVisible) {
      const timer = setTimeout(goToNext, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDelay, animationPhase, goToNext, currentIndex, isDocumentVisible]);

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
        {showConfetti && animationPhase === "visible" && isDocumentVisible && (
          <div className="absolute inset-0 overflow-visible pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => {
              const leftPercent = ((i * 37) % 100) + 0.5;
              return (
                <ConfettiParticle
                  key={`${key}-${i}`}
                  delay={i * 50}
                  color={confettiColors[i % confettiColors.length]}
                  leftPercent={leftPercent}
                />
              );
            })}
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
          {autoClose && animationPhase === "visible" && isDocumentVisible && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-black/10">
              <div
                key={`progress-${key}-${currentIndex}-${progressRestartKey}`}
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
                  {icon}
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
  const showAchievements = useCallback((newAchievements: Achievement[]) => {
    enqueueAchievementToast(newAchievements);
  }, []);

  const closeToast = useCallback(() => {
    clearAchievementToastQueue();
  }, []);

  return {
    achievements: [] as Achievement[],
    showAchievements,
    closeToast,
    ToastComponent: null,
  };
}
