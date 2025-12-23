import { createClient } from "@supabase/supabase-js";
import { env, getEnvErrorMessage } from "@/lib/env";

// Cliente admin com service_role_key para operações privilegiadas
// ATENÇÃO: Este cliente deve ser usado APENAS em server actions/route handlers
// NUNCA expor a service_role_key para o cliente
export const createAdminClient = () => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(getEnvErrorMessage("SUPABASE_SERVICE_ROLE_KEY"));
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
