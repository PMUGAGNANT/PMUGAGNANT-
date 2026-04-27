import { getSupabaseAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/server-logger";

export async function claimPushDelivery(
  deliveryKey: string,
  campaign: string,
  payload: Record<string, unknown>
) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { claimed: false, reason: "supabase_unavailable" as const };
  }

  const { error } = await admin.from("push_notification_deliveries").insert({
    delivery_key: deliveryKey,
    campaign,
    audience: "all",
    payload,
  });

  if (!error) {
    return { claimed: true as const };
  }

  if (error.code === "23505") {
    return { claimed: false as const, reason: "duplicate" as const };
  }

  logger.error("push.delivery_claim_failed", error, {
    deliveryKey,
    campaign,
  });

  return { claimed: false as const, reason: "insert_failed" as const };
}
