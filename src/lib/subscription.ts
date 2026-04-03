import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseRequestClient, getSupabaseAdminClient } from "@/lib/supabase";
import { getBearerToken } from "@/lib/request-utils";

export interface SubscriptionState {
  authenticated: boolean;
  user: User | null;
  isSubscribed: boolean;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
}

export function isActiveSubscriptionStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export async function getRequestSubscriptionState(authorizationHeader: string | null) {
  const token = getBearerToken(authorizationHeader);
  const client = createSupabaseRequestClient(token);

  if (!client) {
    return {
      client: null,
      state: {
        authenticated: false,
        user: null,
        isSubscribed: false,
        subscriptionStatus: "FREE",
        stripeCustomerId: null,
      } satisfies SubscriptionState,
    };
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return {
      client,
      state: {
        authenticated: false,
        user: null,
        isSubscribed: false,
        subscriptionStatus: "FREE",
        stripeCustomerId: null,
      } satisfies SubscriptionState,
    };
  }

  const { data: profile } = await client
    .from("profiles")
    .select("is_subscribed,subscription_status,stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const subscriptionStatus =
    typeof profile?.subscription_status === "string"
      ? profile.subscription_status
      : "FREE";
  const isSubscribed = Boolean(profile?.is_subscribed) || isActiveSubscriptionStatus(subscriptionStatus);

  return {
    client,
    state: {
      authenticated: true,
      user,
      isSubscribed,
      subscriptionStatus,
      stripeCustomerId:
        typeof profile?.stripe_customer_id === "string" ? profile.stripe_customer_id : null,
    } satisfies SubscriptionState,
  };
}

export async function updateSubscriptionByCustomer(
  customerId: string,
  payload: {
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: string | null;
    isSubscribed?: boolean;
  }
) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase admin n'est pas configuré. Ajoutez SUPABASE_SERVICE_ROLE_KEY.");
  }

  const updatePayload: Record<string, unknown> = {};
  if (payload.stripeSubscriptionId !== undefined) {
    updatePayload.stripe_subscription_id = payload.stripeSubscriptionId;
  }
  if (payload.subscriptionStatus !== undefined) {
    updatePayload.subscription_status = payload.subscriptionStatus;
  }
  if (payload.isSubscribed !== undefined) {
    updatePayload.is_subscribed = payload.isSubscribed;
  }

  const { data, error } = await admin
    .from("profiles")
    .update(updatePayload)
    .eq("stripe_customer_id", customerId)
    .select("id");

  if (error) {
    throw new Error(`Subscription update failed: ${error.message}`);
  }

  if (!data?.length) {
    throw new Error(
      `Subscription update matched 0 profiles for stripe_customer_id=${customerId}. ` +
        "Verify ensureStripeCustomer saved the customer id before checkout completes."
    );
  }
}

export async function ensureStripeCustomer(
  client: SupabaseClient,
  userId: string,
  customerId: string
) {
  const { data, error } = await client
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId)
    .select("id");

  if (error) {
    throw new Error(`Stripe customer persistence failed: ${error.message}`);
  }

  if (!data?.length) {
    throw new Error(`Stripe customer persistence failed: no profile row for user ${userId}`);
  }
}
