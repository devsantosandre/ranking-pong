import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Singleton para evitar múltiplas instâncias
let client: ReturnType<typeof createBrowserClient> | null = null;

export const createClient = () => {
  if (!client) {
    client = createBrowserClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return client;
};











