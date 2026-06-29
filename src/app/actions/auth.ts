"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function loginAction(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Verificar is_active via service role (bypassa RLS, garantido server-side)
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("users")
    .select("is_active")
    .eq("id", data.user.id)
    .single();

  if (profile?.is_active === false) {
    // Invalidar a sessão antes que o cookie chegue ao browser
    await supabase.auth.signOut({ scope: "local" });
    return {
      error: "Sua conta está desativada. Entre em contato com o administrador.",
    };
  }

  return {};
}
