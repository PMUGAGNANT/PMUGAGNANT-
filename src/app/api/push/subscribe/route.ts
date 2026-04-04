import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError, serviceUnavailable } from "@/lib/api-response";
import { getOptionalRequestUser } from "@/lib/request-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PushSubscriptionBody = {
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
};

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return serviceUnavailable("Supabase admin n'est pas configure pour enregistrer les alertes push.");
  }

  const auth = await getOptionalRequestUser(request);
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  let body: PushSubscriptionBody;
  try {
    body = (await request.json()) as PushSubscriptionBody;
  } catch (error) {
    return badRequest("Corps JSON invalide.", {
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const endpoint = body.subscription?.endpoint?.trim();
  const p256dh = body.subscription?.keys?.p256dh?.trim();
  const authKey = body.subscription?.keys?.auth?.trim();

  if (!endpoint || !p256dh || !authKey) {
    return badRequest("Subscription push incomplete.");
  }

  const { error } = await admin.from("push_subscriptions").upsert(
    {
      endpoint,
      keys_p256dh: p256dh,
      keys_auth: authKey,
      user_id: auth.user?.id ?? null,
    },
    {
      onConflict: "endpoint",
      ignoreDuplicates: false,
    }
  );

  if (error) {
    return serverError("Impossible d'enregistrer la subscription push.", error, {
      userId: auth.user?.id ?? null,
    });
  }

  return NextResponse.json({ success: true });
}
