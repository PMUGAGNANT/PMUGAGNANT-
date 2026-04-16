import type { User } from "@supabase/supabase-js";
import { createSupabaseRequestClient, getSupabaseAdminClient } from "@/lib/supabase";
import { getBearerToken } from "@/lib/request-utils";

export type PremiumAccessSource = "FREE" | "PAID" | "BONUS";

export interface SubscriptionProfileSnapshot {
  is_subscribed?: boolean | null;
  subscription_status?: string | null;
  stripe_customer_id?: string | null;
  premium_access_expires_at?: string | null;
}

export interface SubscriptionState {
  authenticated: boolean;
  user: User | null;
  isSubscribed: boolean;
  isStripeSubscribed: boolean;
  accessSource: PremiumAccessSource;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  premiumAccessExpiresAt: string | null;
}

export const PROFILE_SUBSCRIPTION_SELECT =
  "is_subscribed,subscription_status,stripe_customer_id,premium_access_expires_at";

export function isActiveSubscriptionStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

function normalizePremiumAccessExpiry(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function hasActivePremiumBonus(
  premiumAccessExpiresAt: string | null | undefined,
  now: Date = new Date()
) {
  if (!premiumAccessExpiresAt) {
    return false;
  }

  const parsed = new Date(premiumAccessExpiresAt);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getTime() > now.getTime();
}

export function buildSubscriptionStateFromProfile(
  profile: SubscriptionProfileSnapshot | null | undefined,
  user: User | null,
  now: Date = new Date()
): SubscriptionState {
  const subscriptionStatus =
    typeof profile?.subscription_status === "string" && profile.subscription_status.trim() !== ""
      ? profile.subscription_status
      : "FREE";
  const premiumAccessExpiresAt = normalizePremiumAccessExpiry(
    profile?.premium_access_expires_at
  );
  const isStripeSubscribed =
    Boolean(profile?.is_subscribed) || isActiveSubscriptionStatus(subscriptionStatus);
  const hasBonusAccess = hasActivePremiumBonus(premiumAccessExpiresAt, now);
  const accessSource: PremiumAccessSource = isStripeSubscribed
    ? "PAID"
    : hasBonusAccess
      ? "BONUS"
      : "FREE";

  return {
    authenticated: Boolean(user),
    user,
    isSubscribed: accessSource !== "FREE",
    isStripeSubscribed,
    accessSource,
    subscriptionStatus: accessSource === "BONUS" ? "BONUS" : subscriptionStatus,
    stripeCustomerId:
      typeof profile?.stripe_customer_id === "string" ? profile.stripe_customer_id : null,
    premiumAccessExpiresAt,
  } satisfies SubscriptionState;
}

export async function getRequestSubscriptionState(authorizationHeader: string | null) {
  const token = getBearerToken(authorizationHeader);
  const client = createSupabaseRequestClient(token);

  if (!client) {
    return {
      client: null,
      state: buildSubscriptionStateFromProfile(null, null),
    };
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return {
      client,
      state: buildSubscriptionStateFromProfile(null, null),
    };
  }

  const { data: profile } = await client
    .from("profiles")
    .select(PROFILE_SUBSCRIPTION_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  return {
    client,
    state: buildSubscriptionStateFromProfile(
      profile as SubscriptionProfileSnapshot | null | undefined,
      user
    ),
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

export async function ensureStripeCustomer(userId: string, customerId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase admin n'est pas configuré. Ajoutez SUPABASE_SERVICE_ROLE_KEY.");
  }

  const { data, error } = await admin
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
