"use client";

import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const SOFT_ASK_DISMISS_KEY_PREFIX = "push-soft-ask-dismissed-until-v1";
const SOFT_ASK_DEFAULT_COOLDOWN_DAYS = 7;
const SERVICE_WORKER_URL = "/sw.js?v=20260218-push-v3";

function toApplicationServerKey(base64UrlString: string): ArrayBuffer {
  const base64 = base64UrlString.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4 || 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer as ArrayBuffer;
}

function isStandaloneDisplayMode() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

type SerializablePushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

function toSerializableSubscription(
  subscription: PushSubscription
): SerializablePushSubscription | null {
  const subscriptionJson = subscription.toJSON();
  const endpoint = subscriptionJson.endpoint;
  const p256dh = subscriptionJson.keys?.p256dh;
  const auth = subscriptionJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    keys: { p256dh, auth },
  };
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const serializable = toSerializableSubscription(subscription);
  if (!serializable) return;

  const userAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };

  await fetch("/api/push/subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscription: serializable,
      platform: userAgentData.userAgentData?.platform || navigator.platform || null,
    }),
  });
}

async function disableSubscription(subscription?: PushSubscription | null): Promise<void> {
  const serializable = subscription ? toSerializableSubscription(subscription) : null;

  await fetch("/api/push/subscription", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ endpoint: serializable?.endpoint }),
  });

  if (subscription) {
    await subscription.unsubscribe();
  }
}

type PushActivationResult = {
  ok: boolean;
  reason?:
    | "not_authenticated"
    | "unsupported"
    | "misconfigured"
    | "permission_denied"
    | "permission_not_granted"
    | "subscribe_failed";
};

type PushSubscriptionContextValue = {
  isSupported: boolean;
  isConfigured: boolean;
  isStandalone: boolean;
  permission: NotificationPermission | "unsupported";
  hasSubscription: boolean;
  isSyncing: boolean;
  isRequestingPermission: boolean;
  dismissedUntil: number | null;
  canShowSoftAsk: boolean;
  syncSubscription: () => Promise<void>;
  requestPermissionAndSubscribe: () => Promise<PushActivationResult>;
  dismissSoftAsk: (days?: number) => void;
  clearSoftAskDismissal: () => void;
};

const noopAsync = async () => {};
const noopActivate = async (): Promise<PushActivationResult> => ({
  ok: false,
  reason: "unsupported",
});

const pushSubscriptionFallback: PushSubscriptionContextValue = {
  isSupported: false,
  isConfigured: false,
  isStandalone: false,
  permission: "unsupported",
  hasSubscription: false,
  isSyncing: false,
  isRequestingPermission: false,
  dismissedUntil: null,
  canShowSoftAsk: false,
  syncSubscription: noopAsync,
  requestPermissionAndSubscribe: noopActivate,
  dismissSoftAsk: () => {},
  clearSoftAskDismissal: () => {},
};

const PushSubscriptionContext =
  createContext<PushSubscriptionContextValue>(pushSubscriptionFallback);

function readDismissedUntil(userId?: string): number | null {
  if (!userId || typeof window === "undefined") return null;
  const rawValue = localStorage.getItem(`${SOFT_ASK_DISMISS_KEY_PREFIX}:${userId}`);
  if (!rawValue) return null;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function writeDismissedUntil(userId: string, timestamp: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${SOFT_ASK_DISMISS_KEY_PREFIX}:${userId}`, String(timestamp));
}

function clearDismissedUntil(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${SOFT_ASK_DISMISS_KEY_PREFIX}:${userId}`);
}

function canUsePushOnClient() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function PushSubscriptionProvider({
  userId,
  children,
}: {
  userId?: string;
  children: ReactNode;
}) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const isConfigured = !!vapidPublicKey;
  const isSupported = canUsePushOnClient();

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (!canUsePushOnClient()) return "unsupported";
    return Notification.permission;
  });
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(null);
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === "undefined") return false;
    return isStandaloneDisplayMode();
  });

  const syncSubscription = useCallback(async () => {
    if (!userId || !isConfigured || !isSupported || !vapidPublicKey) {
      setHasSubscription(false);
      return;
    }

    setIsSyncing(true);
    try {
      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
      await registration.update();
      const existingSubscription = await registration.pushManager.getSubscription();
      const currentPermission = Notification.permission;

      setPermission(currentPermission);
      setHasSubscription(!!existingSubscription);

      if (currentPermission === "denied") {
        if (existingSubscription) {
          await disableSubscription(existingSubscription);
        } else {
          await disableSubscription();
        }
        setHasSubscription(false);
        return;
      }

      if (currentPermission !== "granted") {
        return;
      }

      const subscription =
        existingSubscription ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toApplicationServerKey(vapidPublicKey),
        }));

      await saveSubscription(subscription);
      setHasSubscription(true);
    } catch {
      return;
    } finally {
      setIsSyncing(false);
    }
  }, [isConfigured, isSupported, userId, vapidPublicKey]);

  const requestPermissionAndSubscribe = useCallback(async (): Promise<PushActivationResult> => {
    if (!userId) return { ok: false, reason: "not_authenticated" };
    if (!isSupported) return { ok: false, reason: "unsupported" };
    if (!isConfigured || !vapidPublicKey) return { ok: false, reason: "misconfigured" };

    setIsRequestingPermission(true);
    try {
      const currentPermission = Notification.permission;
      if (currentPermission === "denied") {
        return { ok: false, reason: "permission_denied" };
      }

      const permissionResult =
        currentPermission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        return {
          ok: false,
          reason:
            permissionResult === "denied"
              ? "permission_denied"
              : "permission_not_granted",
        };
      }

      await syncSubscription();
      clearDismissedUntil(userId);
      setDismissedUntil(null);
      return { ok: true };
    } catch {
      return { ok: false, reason: "subscribe_failed" };
    } finally {
      setIsRequestingPermission(false);
    }
  }, [isConfigured, isSupported, syncSubscription, userId, vapidPublicKey]);

  const dismissSoftAsk = useCallback(
    (days = SOFT_ASK_DEFAULT_COOLDOWN_DAYS) => {
      if (!userId) return;
      const nextTimestamp = Date.now() + Math.max(days, 1) * 24 * 60 * 60 * 1000;
      writeDismissedUntil(userId, nextTimestamp);
      setDismissedUntil(nextTimestamp);
    },
    [userId]
  );

  const clearSoftAskDismissal = useCallback(() => {
    if (!userId) return;
    clearDismissedUntil(userId);
    setDismissedUntil(null);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setDismissedUntil(null);
      return;
    }
    setDismissedUntil(readDismissedUntil(userId));
  }, [userId]);

  useEffect(() => {
    if (!isSupported) return;

    const updateLocalState = () => {
      setPermission(Notification.permission);
      setIsStandalone(isStandaloneDisplayMode());
    };

    updateLocalState();

    const onVisibilityChange = () => {
      if (!document.hidden) {
        updateLocalState();
      }
    };

    window.addEventListener("focus", updateLocalState);
    window.addEventListener("pageshow", updateLocalState);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", updateLocalState);
      window.removeEventListener("pageshow", updateLocalState);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isSupported]);

  useEffect(() => {
    void syncSubscription();
  }, [syncSubscription]);

  const canShowSoftAsk = useMemo(() => {
    if (!userId || !isConfigured || !isSupported) return false;
    if (permission !== "default") return false;
    if (!dismissedUntil) return true;
    return dismissedUntil <= Date.now();
  }, [dismissedUntil, isConfigured, isSupported, permission, userId]);

  const contextValue = useMemo<PushSubscriptionContextValue>(
    () => ({
      isSupported,
      isConfigured,
      isStandalone,
      permission,
      hasSubscription,
      isSyncing,
      isRequestingPermission,
      dismissedUntil,
      canShowSoftAsk,
      syncSubscription,
      requestPermissionAndSubscribe,
      dismissSoftAsk,
      clearSoftAskDismissal,
    }),
    [
      canShowSoftAsk,
      clearSoftAskDismissal,
      dismissSoftAsk,
      dismissedUntil,
      hasSubscription,
      isConfigured,
      isRequestingPermission,
      isStandalone,
      isSupported,
      isSyncing,
      permission,
      requestPermissionAndSubscribe,
      syncSubscription,
    ]
  );

  return createElement(PushSubscriptionContext.Provider, { value: contextValue }, children);
}

export function usePushSubscription() {
  return useContext(PushSubscriptionContext);
}
