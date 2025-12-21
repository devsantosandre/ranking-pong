import { AppShell } from "@/components/app-shell";
import { LogListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <AppShell title="Histórico" subtitle="Ações administrativas" showBack>
      <LogListSkeleton count={6} />
    </AppShell>
  );
}
