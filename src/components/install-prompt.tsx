"use client";

import { useState, useEffect } from "react";
import { X, Share, Plus, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("pwa-prompt-dismissed");
    if (dismissed) {
      setIsDismissed(true);
    }

    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as unknown as { MSStream?: unknown }).MSStream
    );

    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true
    );

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (isStandalone || isDismissed) {
    return null;
  }

  if (!isIOS && !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl">
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
              Instalar Smash Pong
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
                className="mt-3 w-full bg-white text-black font-medium py-2.5 px-4 rounded-xl hover:bg-zinc-200 transition-colors text-sm"
              >
                Instalar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
