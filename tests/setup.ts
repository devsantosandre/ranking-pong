import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Carrega .env.test antes de qualquer teste; permite que os testes importem
// utilitários que dependem de process.env.* (Supabase URL/keys, etc).
loadEnv({ path: resolve(__dirname, "..", ".env.test"), override: true });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL ausente — verifique .env.test antes de rodar a suíte."
  );
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY ausente — necessário para criar/limpar usuários de teste."
  );
}
