import webpush, { type PushSubscription } from "web-push";
import { env, hasAdminConfig } from "@/lib/env";
import { createAdminClient } from "@/utils/supabase/admin";

export type PushMessagePayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type WebPushError = Error & {
  statusCode?: number;
  body?: string;
};

let webPushConfigured = false;

function isPushConfigReady(): boolean {
  return !!(
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    env.VAPID_PRIVATE_KEY &&
    env.VAPID_SUBJECT
  );
}

function ensureWebPushConfigured(): boolean {
  if (webPushConfigured) return true;
  if (!isPushConfigReady()) return false;

  webpush.setVapidDetails(
    env.VAPID_SUBJECT as string,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    env.VAPID_PRIVATE_KEY as string
  );

  webPushConfigured = true;
  return true;
}

function buildPushPayload(payload: PushMessagePayload): string {
  const url = payload.url || "/partidas";

  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    url,
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    data: {
      ...payload.data,
      url,
    },
  });
}

function toPushSubscription(row: PushSubscriptionRow): PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, 500);
  }

  return "Erro desconhecido ao enviar push";
}

function isSubscriptionGone(error: unknown): boolean {
  const typedError = error as WebPushError;
  return typedError?.statusCode === 404 || typedError?.statusCode === 410;
}

async function markSubscriptionDisabled(subscriptionId: string, reason: string): Promise<void> {
  const adminClient = createAdminClient();

  await adminClient
    .from("push_subscriptions")
    .update({
      disabled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: reason,
    })
    .eq("id", subscriptionId);
}

async function markSubscriptionError(subscriptionId: string, reason: string): Promise<void> {
  const adminClient = createAdminClient();

  await adminClient
    .from("push_subscriptions")
    .update({
      updated_at: new Date().toISOString(),
      last_error: reason,
    })
    .eq("id", subscriptionId);
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushMessagePayload
): Promise<void> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return;

  if (!hasAdminConfig() || !ensureWebPushConfigured()) {
    return;
  }

  const adminClient = createAdminClient();

  const { data: subscriptions, error } = await adminClient
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", uniqueUserIds)
    .is("disabled_at", null);

  if (error || !subscriptions || subscriptions.length === 0) {
    return;
  }

  const pushPayload = buildPushPayload(payload);

  await Promise.allSettled(
    (subscriptions as PushSubscriptionRow[]).map(async (subscription) => {
      try {
        await webpush.sendNotification(toPushSubscription(subscription), pushPayload);
      } catch (error) {
        const message = getErrorMessage(error);

        if (isSubscriptionGone(error)) {
          await markSubscriptionDisabled(subscription.id, message);
          return;
        }

        await markSubscriptionError(subscription.id, message);
      }
    })
  );
}
