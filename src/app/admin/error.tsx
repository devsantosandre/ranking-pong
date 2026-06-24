"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AdminError]", error);
  }, [error]);

  return (
    <div className="arena flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--arena-primary)" }}>
        Erro
      </p>
      <p className="text-base font-semibold" style={{ color: "var(--arena-foreground)" }}>
        {error?.message ?? "Ocorreu um erro inesperado."}
      </p>
      {error?.digest && (
        <p className="text-xs" style={{ color: "var(--arena-muted)" }}>
          Código: {error.digest}
        </p>
      )}
      <pre
        className="max-w-lg overflow-auto rounded-xl p-3 text-left text-[11px]"
        style={{ background: "color-mix(in srgb, var(--arena-primary) 6%, transparent)", color: "var(--arena-muted)" }}
      >
        {error?.stack ?? "Sem stack trace disponível."}
      </pre>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl px-6 py-2.5 text-sm font-bold text-white"
        style={{ background: "var(--arena-primary)" }}
      >
        Tentar novamente
      </button>
    </div>
  );
}
