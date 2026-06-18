"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { GlassCard } from "@/components/arena/glass-card";
import { Copy, Share2, Check, QrCode } from "lucide-react";

/**
 * Card para o admin compartilhar o link de auto-inscrição (com QR code).
 * O aluno abre o link e se inscreve sozinho enquanto as inscrições estão abertas.
 */
export function ShareRegistration({ tournamentId }: { tournamentId: string }) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const link = `${window.location.origin}/torneios/${tournamentId}/inscrever`;
    let active = true;
    (async () => {
      let dataUrl: string | null = null;
      try {
        dataUrl = await QRCode.toDataURL(link, { width: 320, margin: 1, color: { dark: "#1a0026", light: "#ffffff" } });
      } catch {
        dataUrl = null;
      }
      if (active) {
        setUrl(link);
        setQr(dataUrl);
      }
    })();
    return () => { active = false; };
  }, [tournamentId]);

  function copy() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }
  function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: "Inscrição no torneio", url }).catch(() => {});
    } else {
      copy();
    }
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
          Compartilhe a inscrição
        </p>
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-bold transition hover:opacity-80"
          style={{ color: "var(--arena-primary)" }}
        >
          <QrCode className="h-3.5 w-3.5" />
          {showQr ? "Ocultar QR" : "Mostrar QR"}
        </button>
      </div>

      <p className="text-xs text-(--arena-muted)">
        Envie este link para os jogadores se inscreverem sozinhos.
      </p>

      {/* Link */}
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
      >
        <span className="min-w-0 flex-1 truncate text-xs text-(--arena-foreground)">{url}</span>
      </div>

      {/* Ações */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition hover:opacity-90"
          style={{ background: "color-mix(in srgb, var(--arena-primary) 10%, transparent)", color: "var(--arena-primary)" }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado!" : "Copiar link"}
        </button>
        <button
          type="button"
          onClick={share}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white transition hover:opacity-90"
          style={{ background: "var(--arena-primary)" }}
        >
          <Share2 className="h-3.5 w-3.5" />
          Compartilhar
        </button>
      </div>

      {/* QR */}
      {showQr && qr && (
        <div className="flex flex-col items-center gap-2 pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code de inscrição" className="h-44 w-44 rounded-xl" style={{ border: "1px solid var(--glass-border)" }} />
          <p className="text-[11px] text-(--arena-muted)">Aponte a câmera para abrir a inscrição</p>
        </div>
      )}
    </GlassCard>
  );
}
