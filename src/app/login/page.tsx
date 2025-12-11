"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import { mockUsers } from "@/lib/mock-users";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  return (
    <AppShell title="Login" subtitle="Escolha um usuário para testar" showBack={false}>
      <div className="space-y-4">
        {mockUsers.map((user) => (
          <button
            key={user.id}
            onClick={() => {
              login(user);
              router.push("/");
            }}
            className="w-full rounded-2xl border border-border bg-card px-4 py-4 text-left shadow-sm transition hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </button>
        ))}
      </div>
    </AppShell>
  );
}
