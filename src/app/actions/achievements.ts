"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

type MarkAchievementToastsSeenResult = {
  success: boolean;
  error?: string;
  updatedCount?: number;
};

export async function markAchievementToastsSeenAction(
  userAchievementIds: string[]
): Promise<MarkAchievementToastsSeenResult> {
  const uniqueIds = Array.from(
    new Set(
      (userAchievementIds || []).filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      )
    )
  ).slice(0, 100);

  if (uniqueIds.length === 0) {
    return { success: true, updatedCount: 0 };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Usuário não autenticado" };
  }

  const adminClient = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await adminClient
    .from("user_achievements")
    .update({ toast_seen_at: nowIso })
    .eq("user_id", user.id)
    .in("id", uniqueIds)
    .is("toast_seen_at", null)
    .select("id");

  if (error) {
    return { success: false, error: "Erro ao marcar conquistas como visualizadas" };
  }

  return { success: true, updatedCount: data?.length ?? 0 };
}
