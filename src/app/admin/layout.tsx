"use client";

import { useAuth } from "@/lib/auth-store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, canAccessAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !canAccessAdmin)) {
      router.push("/");
    }
  }, [loading, user, canAccessAdmin, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f4fa]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccessAdmin) {
    return null;
  }

  return <>{children}</>;
}
