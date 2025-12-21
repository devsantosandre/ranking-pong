"use client";

import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";
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

      // Buscar dados completos da tabela users
      const { data: profile } = await supabase
        .from("users")
        .select("full_name, name, rating_atual, role, is_active")
        .eq("id", authUser.id)
        .single();

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
      });
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    // Get initial session
    const getUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      await fetchUserProfile(authUser);
    };

    getUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await fetchUserProfile(session?.user ?? null);
    });

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
