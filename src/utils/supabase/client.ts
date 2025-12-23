import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Usar a chave anon (legacy) que funciona melhor com operações CRUD
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

// Singleton para evitar múltiplas instâncias
let client: ReturnType<typeof createBrowserClient> | null = null;

export const createClient = () => {
  if (!client) {
    client = createBrowserClient(supabaseUrl, supabaseKey);
  }
  return client;
};






