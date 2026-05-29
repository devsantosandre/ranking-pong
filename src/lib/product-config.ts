// Configuração centralizada do branding do produto.
// Todos os valores vêm de variáveis de ambiente NEXT_PUBLIC_* (carregadas em build time).
// Defaults representam a identidade neutra do template (HML "PRODUTO_NOME" + paleta azul).
// Cada deploy (Coolify HML, Vercel PROD, futuros tenants) sobrescreve via env vars próprias.

export const productConfig = {
  name: process.env.NEXT_PUBLIC_PRODUCT_NAME || "PRODUTO_NOME",
  shortName: process.env.NEXT_PUBLIC_PRODUCT_SHORT_NAME || "PRODUTO_NOME",
  ownerLabel: process.env.NEXT_PUBLIC_PRODUCT_OWNER || "PRODUTO_OWNER",
  description:
    process.env.NEXT_PUBLIC_PRODUCT_DESCRIPTION ||
    "Sistema de ranking esportivo com pontuação e notícias em tempo real.",
  sportLabel: process.env.NEXT_PUBLIC_SPORT_LABEL || "esporte",
  sportEmoji: process.env.NEXT_PUBLIC_SPORT_EMOJI || "🏆",

  colors: {
    primary: process.env.NEXT_PUBLIC_PRIMARY_COLOR || "#2563eb",
    primaryDark: process.env.NEXT_PUBLIC_PRIMARY_DARK || "#60a5fa",
    background: process.env.NEXT_PUBLIC_BACKGROUND_COLOR || "#f8fafc",
    backgroundDark: process.env.NEXT_PUBLIC_BACKGROUND_DARK || "#0f172a",
    themeColorPwa: process.env.NEXT_PUBLIC_THEME_COLOR_PWA || "#2563eb",
  },

  assets: {
    logo:
      process.env.NEXT_PUBLIC_LOGO_PATH || "/branding/template/logo.png",
    icon192:
      process.env.NEXT_PUBLIC_ICON_192_PATH ||
      "/branding/template/icon-192.png",
    icon512:
      process.env.NEXT_PUBLIC_ICON_512_PATH ||
      "/branding/template/icon-512.png",
    iconMaskable:
      process.env.NEXT_PUBLIC_ICON_MASKABLE_PATH ||
      "/branding/template/icon-512-maskable.png",
    badge72:
      process.env.NEXT_PUBLIC_BADGE_72_PATH ||
      "/branding/template/badge-72.png",
    appleTouch:
      process.env.NEXT_PUBLIC_APPLE_TOUCH_PATH ||
      "/branding/template/apple-touch-icon.png",
    favicon:
      process.env.NEXT_PUBLIC_FAVICON_PATH ||
      "/branding/template/favicon.ico",
  },

  storageKeyPrefix:
    process.env.NEXT_PUBLIC_STORAGE_PREFIX || "ranking-app",
} as const;

export type ProductConfig = typeof productConfig;

// Helpers convenientes:
export function getBrowserTitle(pageTitle?: string): string {
  if (!pageTitle || !pageTitle.trim()) {
    return `${productConfig.name} | ${productConfig.ownerLabel}`;
  }
  return `${productConfig.name} · ${pageTitle}`;
}

export function storageKey(key: string): string {
  return `${productConfig.storageKeyPrefix}:${key}`;
}
