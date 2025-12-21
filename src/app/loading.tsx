import { AppShell } from "@/components/app-shell";
import { HomePageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <AppShell title="Visão geral" subtitle="Carregando..." showBack={false}>
      <HomePageSkeleton />
    </AppShell>
  );
}
