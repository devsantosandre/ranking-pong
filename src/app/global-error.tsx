"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8f1ff", color: "#2b003c" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: "2rem", gap: "1rem", textAlign: "center" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a421d2", margin: 0 }}>
            Erro na aplicação
          </p>
          <p style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>
            {error?.message ?? "Ocorreu um erro inesperado."}
          </p>
          {error?.digest && (
            <p style={{ fontSize: "11px", color: "#888", margin: 0 }}>
              Código: {error.digest}
            </p>
          )}
          <pre style={{ fontSize: "11px", color: "#666", background: "#f0e8ff", borderRadius: "8px", padding: "12px", maxWidth: "600px", overflow: "auto", textAlign: "left", margin: 0 }}>
            {error?.stack ?? "Sem stack disponível."}
          </pre>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: "8px", padding: "10px 24px", borderRadius: "12px", background: "#a421d2", color: "white", border: "none", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
