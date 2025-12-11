"use client";

import { AppShell } from "@/components/app-shell";
import { useNewsStore } from "@/lib/news-store";

export default function NoticiasPage() {
  const { posts } = useNewsStore();

  return (
    <AppShell
      title="Notícias - Jogos"
      subtitle="Feed de jogos realizados com placares e destaques"
      showBack
    >
      <div className="space-y-4">
        {posts.map((post) => (
          <article
            key={`${post.title}-${post.winner}`}
            className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4 shadow-sm"
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                Notícias
              </p>
              <h2 className="text-lg font-semibold text-foreground">
                {post.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {post.season} • {post.timeAgo}
              </p>
            </div>
            <p className="text-base leading-6">
              <span className="font-semibold text-green-600">
                {post.winner}
              </span>{" "}
              ganhou de{" "}
              <span className="font-semibold text-red-500">{post.loser}</span>{" "}
              por <span className="font-semibold">{post.score}</span>.
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">
                Resultado
              </span>
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-1 text-foreground transition hover:text-primary">
                  👍 <span className="text-xs">0</span>
                </button>
                <button className="flex items-center gap-1 text-foreground transition hover:text-primary">
                  👎 <span className="text-xs">0</span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
