/**
 * Bolinha "ao vivo" — sinaliza que há uma partida em andamento AGORA
 * (status do torneio "ativo" ≠ jogo rolando neste instante).
 * Vermelha (token --state-noshow) com anel pulsante, convenção de transmissão ao vivo.
 */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={`relative flex h-2.5 w-2.5 shrink-0 ${className ?? ""}`} aria-hidden>
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
        style={{ background: "var(--state-noshow)" }}
      />
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-full"
        style={{ background: "var(--state-noshow)" }}
      />
    </span>
  );
}
