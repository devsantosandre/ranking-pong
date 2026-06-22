"use client";

import { useEffect } from "react";
import { isStandalonePwa, lockPwaViewport } from "@/lib/pwa/is-standalone";

export function PwaViewportLock() {
  useEffect(() => {
    lockPwaViewport();
    if (!isStandalonePwa()) return;

    const blockPinchZoom = (event: Event) => {
      event.preventDefault();
    };

    document.addEventListener("gesturestart", blockPinchZoom, { passive: false });
    document.addEventListener("gesturechange", blockPinchZoom, { passive: false });
    document.addEventListener("gestureend", blockPinchZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", blockPinchZoom);
      document.removeEventListener("gesturechange", blockPinchZoom);
      document.removeEventListener("gestureend", blockPinchZoom);
    };
  }, []);

  return null;
}
