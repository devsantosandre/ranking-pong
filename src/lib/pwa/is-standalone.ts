export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function lockPwaViewport(): void {
  if (!isStandalonePwa()) return;

  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;

  meta.setAttribute(
    "content",
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
  );
}
