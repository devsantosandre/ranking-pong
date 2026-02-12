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

const AUTH_REQUEST_TIMEOUT_MS = 8000;
const PROFILE_REQUEST_TIMEOUT_MS = 12000;
const SIGN_OUT_TIMEOUT_MS = 4000;
const AUTH_INIT_FALLBACK_TIMEOUT_MS = 15000;

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

function isTimeoutError(error: unknown, message?: string) {
  if (!(error instanceof Error)) return false;
  const isTimeout = error.name === "TimeoutError";
  if (!message) return isTimeout;
  return isTimeout && error.message === message;
}

function buildFallbackAuthUser(authUser: User, previousUser: AuthUser | null): AuthUser {
  const sameUser = previousUser?.id === authUser.id;
  return {
    id: authUser.id,
    name:
      previousUser?.name ||
      authUser.user_metadata?.name ||
      authUser.email?.split("@")[0] ||
      "Usuario",
    email: authUser.email,
    rating: sameUser ? (previousUser?.rating ?? 250) : 250,
    role: sameUser ? (previousUser?.role ?? "player") : "player",
    isActive: sameUser ? (previousUser?.isActive ?? true) : true,
    hideFromRanking: sameUser ? (previousUser?.hideFromRanking ?? false) : false,
  };
}

async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(errorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Usar useMemo para garantir que o cliente seja estável entre renders
  // O createClient já é um singleton, mas precisamos de uma referência estável
  const supabase = useMemo(() => createClient(), []);

  const safeSignOut = useCallback(async (scope: "local" | "global" | "others" = "local") => {
    try {
      await withTimeout(
        supabase.auth.signOut({ scope }),
        SIGN_OUT_TIMEOUT_MS,
        `Timeout ao executar signOut (${scope})`
      );
    } catch {
      // noop
    }
  }, [supabase]);

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
      const { data: profile, error } = await withTimeout<{
        data: {
          full_name: string | null;
          name: string | null;
          rating_atual: number | null;
          role: UserRole | null;
          is_active: boolean | null;
          hide_from_ranking: boolean | null;
        } | null;
        error: { name?: string } | null;
      }>(
        supabase
          .from("users")
          .select("full_name, name, rating_atual, role, is_active, hide_from_ranking")
          .eq("id", authUser.id)
          .single() as Promise<{
            data: {
              full_name: string | null;
              name: string | null;
              rating_atual: number | null;
              role: UserRole | null;
              is_active: boolean | null;
              hide_from_ranking: boolean | null;
            } | null;
            error: { name?: string } | null;
          }>,
        PROFILE_REQUEST_TIMEOUT_MS,
        "Timeout ao buscar perfil do usuario"
      );

      if (error) {
        setUser((previousUser) => buildFallbackAuthUser(authUser, previousUser));
        return;
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
    } catch {
      // Mantém dados de fallback/cached para evitar degradar a sessão em erros transitórios
      setUser((previousUser) => buildFallbackAuthUser(authUser, previousUser));
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
    const bootstrapGuardTimer = setTimeout(() => {
      if (!isMounted || isInitialized) return;
      isInitialized = true;
      setLoading(false);
    }, AUTH_INIT_FALLBACK_TIMEOUT_MS);

    // Get initial session
    const getUser = async () => {
      try {
        const {
          data: { user: authUser },
          error,
        } = await withTimeout(
          supabase.auth.getUser(),
          AUTH_REQUEST_TIMEOUT_MS,
          "Timeout ao verificar sessao de autenticacao"
        );

        if (!isMounted) return;

        if (error) {
          // AuthSessionMissingError é esperado quando não há usuário logado
          if (error.name !== "AuthSessionMissingError") {
            // Limpar sessão local sem bloquear UI
            void safeSignOut("local");
          }
          setUser(null);
          setLoading(false);
          return;
        }

        await fetchUserProfile(authUser);
      } catch (error) {
        if (!isMounted) return;
        if (isTimeoutError(error, "Timeout ao verificar sessao de autenticacao")) {
          setLoading(false);
          return;
        }

        // Em caso de erro inesperado, limpar sessão local sem bloquear UI
        setUser(null);
        void safeSignOut("local");
        setLoading(false);
      } finally {
        isInitialized = true;
        clearTimeout(bootstrapGuardTimer);
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
      clearTimeout(bootstrapGuardTimer);
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserProfile, safeSignOut]);

  const logout = useCallback(async () => {
    setUser(null);
    setLoading(false);
    await safeSignOut("local");
  }, [safeSignOut]);

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
