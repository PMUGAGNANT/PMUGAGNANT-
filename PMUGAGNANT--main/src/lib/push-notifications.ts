import webpush from "web-push";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/server-logger";

export type PushNotificationPayload = {
  title: string;
  body: string;
  url: string;
  icon?: string;
  badge?: string;
  tag?: string;
  image?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
  }>;
  data?: Record<string, unknown>;
};

type StoredPushSubscription = {
  id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
};

function hasPushConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_EMAIL
  );
}

function configureWebPush() {
  if (!hasPushConfig()) {
    return false;
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  return true;
}

function getPushStatusCode(error: unknown) {
  return typeof error === "object" && error && "statusCode" in error
    ? Number((error as { statusCode?: number }).statusCode)
    : null;
}

export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin || !configureWebPush()) {
    return;
  }

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,keys_p256dh,keys_auth")
    .eq("user_id", userId);

  if (error) {
    logger.error("push.subscriptions_fetch_failed", error, { userId });
    return;
  }

  for (const subscription of (data ?? []) as StoredPushSubscription[]) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys_p256dh,
            auth: subscription.keys_auth,
          },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url,
          icon: payload.icon ?? "/favicon.ico",
          badge: payload.badge ?? "/favicon.ico",
          tag: payload.tag ?? "pmu-signal",
          image: payload.image,
          renotify: payload.renotify ?? false,
          requireInteraction: payload.requireInteraction ?? false,
          actions: payload.actions ?? [],
          data: payload.data ?? {},
        })
      );
    } catch (pushError) {
      const statusCode = getPushStatusCode(pushError);
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
      } else {
        logger.warn("push.send_failed", {
          userId,
          subscriptionId: subscription.id,
          error: pushError instanceof Error ? pushError.message : String(pushError),
        });
      }
    }
  }
}

export async function sendPushNotificationToAll(
  payload: PushNotificationPayload
): Promise<{ sent: number; removed: number; skipped: boolean }> {
  const admin = getSupabaseAdminClient();
  if (!admin || !configureWebPush()) {
    return { sent: 0, removed: 0, skipped: true };
  }

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,keys_p256dh,keys_auth");

  if (error) {
    logger.error("push.broadcast_fetch_failed", error);
    return { sent: 0, removed: 0, skipped: false };
  }

  let sent = 0;
  let removed = 0;

  for (const subscription of (data ?? []) as StoredPushSubscription[]) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys_p256dh,
            auth: subscription.keys_auth,
          },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url,
          icon: payload.icon ?? "/favicon.ico",
          badge: payload.badge ?? "/favicon.ico",
          tag: payload.tag ?? "pmu-signal",
          image: payload.image,
          renotify: payload.renotify ?? false,
          requireInteraction: payload.requireInteraction ?? false,
          actions: payload.actions ?? [],
          data: payload.data ?? {},
        })
      );
      sent += 1;
    } catch (pushError) {
      const statusCode = getPushStatusCode(pushError);
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        removed += 1;
      } else {
        logger.warn("push.broadcast_failed", {
          subscriptionId: subscription.id,
          error: pushError instanceof Error ? pushError.message : String(pushError),
        });
      }
    }
  }

  return { sent, removed, skipped: false };
}
