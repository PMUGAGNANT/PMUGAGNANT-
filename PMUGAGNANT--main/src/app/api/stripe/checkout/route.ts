import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError, unauthorized } from "@/lib/api-response";
import { ensureStripeCustomer, getRequestSubscriptionState } from "@/lib/subscription";
import {
  getSiteUrl,
  getStripeConfigError,
  getStripePriceId,
  getStripeServerClient,
  hasStripeConfig,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

interface CheckoutOptions {
  successPath: string;
  cancelPath: string;
  source: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCheckoutPath(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.length > 240
  ) {
    return fallback;
  }

  return trimmed;
}

function normalizeSource(value: unknown) {
  if (typeof value !== "string") {
    return "app";
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "app";
}

async function readCheckoutOptions(request: NextRequest): Promise<CheckoutOptions> {
  const defaults: CheckoutOptions = {
    successPath: "/mes-paris?subscription=success&next=/dashboard",
    cancelPath: "/mes-paris?subscription=cancel",
    source: "app",
  };

  try {
    const payload = (await request.json()) as unknown;
    if (!isRecord(payload)) {
      return defaults;
    }

    return {
      successPath: normalizeCheckoutPath(payload.successPath, defaults.successPath),
      cancelPath: normalizeCheckoutPath(payload.cancelPath, defaults.cancelPath),
      source: normalizeSource(payload.source),
    };
  } catch {
    return defaults;
  }
}

function buildStripeRedirectUrl(path: string, includeSessionId: boolean) {
  const baseUrl = getSiteUrl();
  if (!includeSessionId) {
    return `${baseUrl}${path}`;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${baseUrl}${path}${separator}session_id={CHECKOUT_SESSION_ID}`;
}

export async function POST(request: NextRequest) {
  if (!hasStripeConfig()) {
    return serverError(getStripeConfigError());
  }

  try {
    const checkoutOptions = await readCheckoutOptions(request);
    const { state } = await getRequestSubscriptionState(
      request.headers.get("authorization")
    );

    if (!state.authenticated || !state.user) {
      return unauthorized("Connexion requise pour souscrire.");
    }

    if (state.isStripeSubscribed) {
      return badRequest("Abonnement deja actif.");
    }

    const stripe = getStripeServerClient();
    let customerId = state.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: state.user.email ?? undefined,
        metadata: { userId: state.user.id },
      });
      customerId = customer.id;
      await ensureStripeCustomer(state.user.id, customerId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: getStripePriceId()!, quantity: 1 }],
      success_url: buildStripeRedirectUrl(checkoutOptions.successPath, true),
      cancel_url: buildStripeRedirectUrl(checkoutOptions.cancelPath, false),
      allow_promotion_codes: true,
      client_reference_id: state.user.id,
      metadata: { userId: state.user.id, source: checkoutOptions.source },
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    return serverError("Stripe checkout failed", error);
  }
}
