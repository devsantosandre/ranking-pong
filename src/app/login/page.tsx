"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { buildBrowserTitle } from "@/lib/app-title";

const POST_LOGIN_REDIRECT_KEY = "post_login_redirect_started_at_v1";
const POST_LOGIN_REDIRECT_MAX_AGE_MS = 15_000;

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    document.title = buildBrowserTitle("Entrar");
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    router.replace("/");
  }, [router, user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawStartedAt = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    if (!rawStartedAt) return;

    const startedAt = Number(rawStartedAt);
    const expired =
      !Number.isFinite(startedAt) ||
      Date.now() - startedAt > POST_LOGIN_REDIRECT_MAX_AGE_MS;

    if (expired || (!authLoading && !user?.id && !loading)) {
      sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    }
  }, [authLoading, loading, user?.id]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
      }
      setError(error.message);
      setLoading(false);
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, String(Date.now()));
    }
    router.replace("/");
  };

  const shouldShowPostLoginTransition = (() => {
    if (typeof window === "undefined") return false;
    const rawStartedAt = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    if (!rawStartedAt) return false;
    if (!Number.isFinite(Number(rawStartedAt))) return false;
    return authLoading || !!user?.id;
  })();

  if (shouldShowPostLoginTransition) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/90 to-primary p-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/20 px-6 py-5 text-white shadow-lg">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm font-medium">Entrando na aplicação...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/90 to-primary p-4">
      <div className="w-full max-w-[380px] space-y-6">
        {/* Logo / Branding */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-48 w-48 items-center justify-center rounded-2xl bg-white/20 shadow-lg overflow-hidden p-4">
            <Image
              src="/smash-pong-logo.png"
              alt="Smash Pong App Logo"
              width={152}
              height={152}
              className="object-contain"
            />
          </div>
          <p className="mt-1 text-sm text-white/70">
            Entre na sua conta
          </p>
        </div>

        {/* Card de autenticação */}
        <div className="rounded-3xl bg-white p-6 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={3}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-xl bg-green-500/10 p-3 text-sm text-green-600">
                {message}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/50">
          © {new Date().getFullYear()} Smash Pong App. Todos os direitos reservados.
        </p>
      </div>
    </main>
  );
}
