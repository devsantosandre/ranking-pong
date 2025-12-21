import { AppShell } from "@/components/app-shell";
import { NewsListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <AppShell
      title="Notícias"
      subtitle="Feed de resultados e destaques"
      showBack
    >
      <NewsListSkeleton count={4} />
    </AppShell>
  );
}
