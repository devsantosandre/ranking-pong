export const APP_TITLE = "Smash Pong App";
export const APP_OWNER = "ALSS Tech";
export const APP_DEFAULT_BROWSER_TITLE = `${APP_TITLE} | ${APP_OWNER}`;

export function buildBrowserTitle(pageTitle?: string): string {
  if (!pageTitle || !pageTitle.trim()) {
    return APP_DEFAULT_BROWSER_TITLE;
  }

  return `${APP_TITLE} · ${pageTitle}`;
}
