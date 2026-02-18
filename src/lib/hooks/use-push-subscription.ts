"use client";

import { useEffect } from "react";

const PERMISSION_REQUEST_KEY_PREFIX = "push-permission-requested-v1";

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

export function usePushSubscriptionSync(userId?: string) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!userId) return;
    if (!vapidPublicKey) return;

    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      return;
    }

    let cancelled = false;

    const sync = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existingSubscription = await registration.pushManager.getSubscription();

        if (cancelled) return;

        if (Notification.permission === "denied") {
          await disableSubscription(existingSubscription);
          return;
        }

        if (Notification.permission === "granted") {
          if (existingSubscription) {
            await saveSubscription(existingSubscription);
            return;
          }

          const newSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: toApplicationServerKey(vapidPublicKey),
          });

          await saveSubscription(newSubscription);
          return;
        }

        if (Notification.permission !== "default") {
          return;
        }

        if (!isStandaloneDisplayMode()) {
          return;
        }

        const permissionKey = `${PERMISSION_REQUEST_KEY_PREFIX}:${userId}`;
        const wasAlreadyPrompted = localStorage.getItem(permissionKey) === "true";

        if (wasAlreadyPrompted) {
          return;
        }

        localStorage.setItem(permissionKey, "true");

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          return;
        }

        const currentSubscription =
          existingSubscription ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: toApplicationServerKey(vapidPublicKey),
          }));

        await saveSubscription(currentSubscription);
      } catch {
        return;
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [userId, vapidPublicKey]);
}
