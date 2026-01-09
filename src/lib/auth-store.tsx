"use client";

import { createClient } from "@/utils/supabase/client";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type UserRole = "player" | "moderator" | "admin";

export type AuthUser = {
  id: string;
  name: string;
  email?: string;
  rating?: number;
  role: UserRole;
  isActive: boolean;
  hideFromRanking: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isModerator: boolean;
  canAccessAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Usar useMemo para garantir que o cliente seja estável entre renders
  // O createClient já é um singleton, mas precisamos de uma referência estável
  const supabase = useMemo(() => createClient(), []);

  // Usar useRef para evitar recriação da função de fetch
  const fetchUserProfileRef = useRef<(authUser: User | null) => Promise<void>>(
    async () => {} // Inicialização vazia, será substituída abaixo
  );

  fetchUserProfileRef.current = async (authUser: User | null) => {
    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      // Buscar dados completos da tabela users
      const { data: profile, error } = await supabase
        .from("users")
        .select("full_name, name, rating_atual, role, is_active, hide_from_ranking")
        .eq("id", authUser.id)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
      }

      setUser({
        id: authUser.id,
        name:
          profile?.full_name ||
          profile?.name ||
          authUser.user_metadata?.name ||
          authUser.email?.split("@")[0] ||
          "Usuario",
        email: authUser.email,
        rating: profile?.rating_atual ?? 250,
        role: (profile?.role as UserRole) || "player",
        isActive: profile?.is_active ?? true,
        hideFromRanking: profile?.hide_from_ranking ?? false,
      });
    } catch (error) {
      console.error("Error in fetchUserProfile:", error);
      // Set user with basic info even if profile fetch fails
      setUser({
        id: authUser.id,
        name: authUser.email?.split("@")[0] || "Usuario",
        email: authUser.email,
        rating: 250,
        role: "player",
        isActive: true,
        hideFromRanking: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Wrapper estável para chamar a função atual
  const fetchUserProfile = useCallback(async (authUser: User | null) => {
    await fetchUserProfileRef.current?.(authUser);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let isInitialized = false;

    // Get initial session
    const getUser = async () => {
      try {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (error) {
          // AuthSessionMissingError é esperado quando não há usuário logado
          if (error.name !== "AuthSessionMissingError") {
            console.error("Error getting user:", error);
            // Limpar sessão inválida para evitar loops
            try {
              await supabase.auth.signOut();
            } catch {
              // Ignorar erros ao fazer signOut
            }
          }
          setUser(null);
          setLoading(false);
          return;
        }

        await fetchUserProfile(authUser);
      } catch (error) {
        if (!isMounted) return;
        console.error("Error in getUser:", error);
        // Em caso de erro inesperado, limpar sessão
        setUser(null);
        try {
          await supabase.auth.signOut();
        } catch {
          // Ignorar erros ao fazer signOut
        }
        setLoading(false);
      } finally {
        isInitialized = true;
      }
    };

    getUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!isMounted) return;

        // Ignorar INITIAL_SESSION pois getUser() já tratou a inicialização
        if (event === "INITIAL_SESSION") return;

        // Para outros eventos, só processar depois que a inicialização completou
        if (!isInitialized) return;

        await fetchUserProfile(session?.user ?? null);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserProfile]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  // Helpers de permissao - memoizados para evitar recálculo
  const contextValue = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    logout,
    isAdmin: user?.role === "admin",
    isModerator: user?.role === "moderator",
    canAccessAdmin: user?.role === "admin" || user?.role === "moderator",
  }), [user, loading, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
