"use client";

import { createClient } from "@/utils/supabase/client";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
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
  const supabase = createClient();

  const fetchUserProfile = useCallback(
    async (authUser: User | null) => {
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
    },
    [supabase]
  );

  useEffect(() => {
    // Get initial session
    const getUser = async () => {
      try {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser();

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
        console.error("Error in getUser:", error);
        // Em caso de erro inesperado, limpar sessão
        setUser(null);
        try {
          await supabase.auth.signOut();
        } catch {
          // Ignorar erros ao fazer signOut
        }
        setLoading(false);
      }
    };

    getUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        await fetchUserProfile(session?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserProfile]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  // Helpers de permissao
  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator";
  const canAccessAdmin = user?.role === "admin" || user?.role === "moderator";

  return (
    <AuthContext.Provider
      value={{ user, loading, logout, isAdmin, isModerator, canAccessAdmin }}
    >
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
