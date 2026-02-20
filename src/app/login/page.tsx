"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { buildBrowserTitle } from "@/lib/app-title";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    document.title = buildBrowserTitle("Entrar");
  }, []);

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
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

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
