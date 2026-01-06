import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "./query-keys";

export interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_at: string | null;
}

async function fetchSettings(): Promise<Setting[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .order("key");

  if (error) {
    console.error("Erro ao buscar settings:", error);
    throw error;
  }

  return data || [];
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: fetchSettings,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
