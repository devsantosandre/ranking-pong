// Configuração de variáveis de ambiente
// Leitura dinâmica para garantir que pegue os valores em runtime

export const env = {
  get NEXT_PUBLIC_SUPABASE_URL(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  },

  get NEXT_PUBLIC_SUPABASE_ANON_KEY(): string {
    return (
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
      ""
    );
  },

  get SUPABASE_SERVICE_ROLE_KEY(): string | undefined {
    // Apenas disponível no servidor
    if (typeof window !== "undefined") return undefined;
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  },

  get NEXT_PUBLIC_VAPID_PUBLIC_KEY(): string | undefined {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  },

  get VAPID_PRIVATE_KEY(): string | undefined {
    if (typeof window !== "undefined") return undefined;
    return process.env.VAPID_PRIVATE_KEY;
  },

  get VAPID_SUBJECT(): string | undefined {
    if (typeof window !== "undefined") return undefined;
    return process.env.VAPID_SUBJECT;
  },
};

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
    NEXT_PUBLIC_VAPID_PUBLIC_KEY:
      "A chave pública VAPID não está configurada. Defina NEXT_PUBLIC_VAPID_PUBLIC_KEY.",
    VAPID_PRIVATE_KEY:
      "A chave privada VAPID não está configurada. Defina VAPID_PRIVATE_KEY no servidor.",
    VAPID_SUBJECT:
      "O assunto VAPID não está configurado. Defina VAPID_SUBJECT (ex: mailto:admin@dominio.com).",
  };

  return messages[varName] || `Variável ${varName} não configurada.`;
}
