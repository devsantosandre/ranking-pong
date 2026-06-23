import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/admin";

// Sempre dinâmico: o gate de role precisa rodar a cada requisição.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate autoritativo no servidor — não dá pra burlar pelo client (ao contrário
  // do redirect via useEffect anterior). Fail-closed: erro/sem-sessão → fora.
  const allowed = await canAccessAdmin().catch(() => false);
  if (!allowed) redirect("/");

  return (
    <div className="arena min-h-screen" style={{ background: "var(--arena-bg-1)" }}>
      {children}
    </div>
  );
}
