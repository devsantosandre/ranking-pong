"use client";

import { useEffect, useRef, useState } from "react";
import { X, Share, Plus, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-prompt-dismissed";

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream
  );
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [isIOS] = useState(() => (typeof window !== "undefined" ? isIOSDevice() : false));
  const [isStandalone, setIsStandalone] = useState(() =>
    typeof window !== "undefined" ? isStandaloneDisplayMode() : false
  );
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DISMISS_KEY) === "true";
  });
  const [isInstalling, setIsInstalling] = useState(false);
  const installFallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && (window.isSecureContext || window.location.hostname === "localhost")) {
      void navigator.serviceWorker.register("/sw.js");
    }

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      setIsStandalone(event.matches);
    };

    mediaQuery.addEventListener("change", handleDisplayModeChange);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      if (installFallbackTimerRef.current) {
        window.clearTimeout(installFallbackTimerRef.current);
      }
      installFallbackTimerRef.current = null;
      setIsStandalone(true);
      setDeferredPrompt(null);
      setIsInstalling(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", handleInstalled);
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
      if (installFallbackTimerRef.current) {
        window.clearTimeout(installFallbackTimerRef.current);
      }
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt || isInstalling) return;

    const installEvent = deferredPrompt;
    setDeferredPrompt(null);
    setIsInstalling(true);

    try {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;

      if (outcome !== "accepted") {
        setIsInstalling(false);
        return;
      }

      installFallbackTimerRef.current = window.setTimeout(() => {
        setIsInstalling(false);
      }, 15000);
    } catch {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  if (isStandalone || isDismissed) {
    return null;
  }

  if (!isIOS && !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-[9999] px-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="relative mx-auto w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
            <Download className="w-6 h-6 text-white" />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <h3 className="font-semibold text-white text-base">
              Instalar Smash Pong App
            </h3>

            {isIOS ? (
              <div className="mt-2 text-sm text-zinc-400">
                <p className="flex items-center gap-1.5">
                  Toque em{" "}
                  <Share size={16} className="inline text-blue-400" /> e depois{" "}
                  <span className="inline-flex items-center gap-1 text-zinc-300">
                    <Plus size={14} /> Adicionar à Tela Inicial
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-zinc-400">
                Instale o app para acesso rápido
              </p>
            )}

            {!isIOS && deferredPrompt && (
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="mt-3 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {isInstalling ? "Instalando..." : "Instalar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
