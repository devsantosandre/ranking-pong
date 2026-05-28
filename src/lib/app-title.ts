// Re-exporta valores de productConfig para compatibilidade com código existente
// que importa APP_TITLE/APP_OWNER/etc. Novos códigos devem usar `productConfig` diretamente.

import { productConfig, getBrowserTitle } from "./product-config";

export const APP_TITLE = productConfig.name;
export const APP_OWNER = productConfig.ownerLabel;
export const APP_DEFAULT_BROWSER_TITLE = `${APP_TITLE} | ${APP_OWNER}`;

export function buildBrowserTitle(pageTitle?: string): string {
  return getBrowserTitle(pageTitle);
}
