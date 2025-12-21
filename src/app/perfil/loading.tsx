import { AppShell } from "@/components/app-shell";
import { ProfilePageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <AppShell title="Perfil" subtitle="Carregando..." showBack>
      <ProfilePageSkeleton />
    </AppShell>
  );
}
