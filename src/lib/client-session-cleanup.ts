"use client";

import { clearPersistedQueryCache } from "@/lib/query-persistence";
import { productConfig } from "@/lib/product-config";

const ACHIEVEMENT_TOAST_QUEUE_STORAGE_KEY = `${productConfig.storageKeyPrefix}:achievement-toast-queue:v1`;
const ACHIEVEMENT_TOAST_QUEUE_EVENT = `${productConfig.storageKeyPrefix}:achievement-toast-queue:changed`;
const POST_LOGIN_REDIRECT_KEY = "post_login_redirect_started_at_v1";

export function clearClientSessionData() {
  if (typeof window === "undefined") return;

  clearPersistedQueryCache();

  try {
    window.localStorage.removeItem(ACHIEVEMENT_TOAST_QUEUE_STORAGE_KEY);
  } catch {
    // noop
  }

  try {
    window.dispatchEvent(new CustomEvent(ACHIEVEMENT_TOAST_QUEUE_EVENT));
  } catch {
    // noop
  }

  try {
    window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  } catch {
    // noop
  }
}
