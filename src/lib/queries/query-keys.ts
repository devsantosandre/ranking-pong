// Chaves de query centralizadas para evitar erros de digitação
// e facilitar invalidação de cache

export const queryKeys = {
  // Users
  users: {
    all: ["users"] as const,
    list: () => [...queryKeys.users.all, "list"] as const,
    detail: (id: string) => [...queryKeys.users.all, "detail", id] as const,
    ranking: () => [...queryKeys.users.all, "ranking"] as const,
  },

  // Matches
  matches: {
    all: ["matches"] as const,
    list: (userId?: string) => [...queryKeys.matches.all, "list", userId] as const,
    detail: (id: string) => [...queryKeys.matches.all, "detail", id] as const,
    pending: (userId: string) => [...queryKeys.matches.all, "pending", userId] as const,
    recent: (userId: string) => [...queryKeys.matches.all, "recent", userId] as const,
  },

  // Daily limits
  dailyLimits: {
    all: ["daily-limits"] as const,
    check: (userId: string, opponentId: string, date: string) =>
      [...queryKeys.dailyLimits.all, userId, opponentId, date] as const,
  },

  // Settings
  settings: ["settings"] as const,

  // Achievements
  achievements: {
    all: ["achievements"] as const,
    user: (userId: string) => ["achievements", "user", userId] as const,
  },
};











