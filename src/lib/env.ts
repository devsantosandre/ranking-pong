// Validação de variáveis de ambiente
// Este arquivo deve ser importado o mais cedo possível na aplicação

type EnvConfig = {
  // Variáveis públicas (disponíveis no cliente)
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  // Variáveis privadas (apenas servidor)
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];

  if (!value && required) {
    throw new Error(
      `Variável de ambiente ${name} não está configurada. ` +
        `Verifique seu arquivo .env.local ou as variáveis de ambiente do servidor.`
    );
  }

  return value || "";
}

function validateEnv(): EnvConfig {
  // Variáveis públicas - sempre obrigatórias
  const NEXT_PUBLIC_SUPABASE_URL = getEnvVar("NEXT_PUBLIC_SUPABASE_URL");

  // Permitir fallback para a chave publishable
  const NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    "";

  if (!NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Nenhuma chave de API do Supabase encontrada. " +
        "Configure NEXT_PUBLIC_SUPABASE_ANON_KEY ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY."
    );
  }

  // Variável privada - apenas necessária para operações admin no servidor
  // Não validar no cliente (typeof window !== 'undefined')
  const SUPABASE_SERVICE_ROLE_KEY =
    typeof window === "undefined"
      ? process.env.SUPABASE_SERVICE_ROLE_KEY
      : undefined;

  return {
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
  };
}

// Exportar a configuração validada
export const env = validateEnv();

// Função auxiliar para verificar se as variáveis de admin estão configuradas
export function hasAdminConfig(): boolean {
  return !!env.SUPABASE_SERVICE_ROLE_KEY;
}

// Função para obter mensagem de erro amigável
export function getEnvErrorMessage(varName: string): string {
  const messages: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL:
      "A URL do Supabase não está configurada. Verifique a variável NEXT_PUBLIC_SUPABASE_URL.",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      "A chave pública do Supabase não está configurada. Verifique a variável NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    SUPABASE_SERVICE_ROLE_KEY:
      "A chave de serviço do Supabase não está configurada. " +
      "Esta chave é necessária para operações de administração. " +
      "Configure a variável SUPABASE_SERVICE_ROLE_KEY no servidor.",
  };

  return messages[varName] || `Variável ${varName} não configurada.`;
}
