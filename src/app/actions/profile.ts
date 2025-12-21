"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!currentPassword || currentPassword.length < 6) {
    return { success: false, error: "Senha atual invalida" };
  }

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: "Nova senha deve ter no minimo 6 caracteres" };
  }

  if (currentPassword === newPassword) {
    return { success: false, error: "Nova senha deve ser diferente da atual" };
  }

  const supabase = await createClient();

  // Verificar usuario logado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { success: false, error: "Usuario nao autenticado" };
  }

  // Verificar senha atual fazendo login
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return { success: false, error: "Senha atual incorreta" };
  }

  // Atualizar senha
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { success: false, error: `Erro ao alterar senha: ${updateError.message}` };
  }

  revalidatePath("/perfil");

  return { success: true };
}
