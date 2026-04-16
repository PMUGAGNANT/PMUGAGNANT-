import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { badRequest, serverError, unauthorized } from "@/lib/api-response";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PushSendBody = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
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

function assertAuthorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${expected}`;
}

export async function POST(request: NextRequest) {
  if (!assertAuthorized(request)) {
    return unauthorized("Autorisation cron requise.");
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return serverError("Supabase admin n'est pas configure pour les notifications push.");
  }

  if (!hasPushConfig()) {
    return NextResponse.json(
      { success: false, sent: 0, removed: 0, error: "VAPID non configure" },
      { status: 503 }
    );
  }

  let body: PushSendBody;
  try {
    body = (await request.json()) as PushSendBody;
  } catch (error) {
    return badRequest("Corps JSON invalide.", {
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const title = body.title?.trim();
  const message = body.body?.trim();
  const url = body.url?.trim() || "/";
  const tag = body.tag?.trim() || "pmu-signal";

  if (!title || !message) {
    return badRequest("Payload push incomplet.");
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,keys_p256dh,keys_auth");

  if (error) {
    return serverError("Impossible de charger les subscriptions push.", error);
  }

  let sent = 0;
  let removed = 0;

  for (const subscription of (subscriptions ?? []) as StoredPushSubscription[]) {
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
          title,
          body: message,
          url,
          tag,
        })
      );
      sent += 1;
    } catch (pushError) {
      const statusCode =
        typeof pushError === "object" && pushError && "statusCode" in pushError
          ? Number((pushError as { statusCode?: number }).statusCode)
          : null;

      if (statusCode === 404 || statusCode === 410) {
        const { error: deleteError } = await admin
          .from("push_subscriptions")
          .delete()
          .eq("id", subscription.id);

        if (!deleteError) {
          removed += 1;
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    removed,
  });
}
