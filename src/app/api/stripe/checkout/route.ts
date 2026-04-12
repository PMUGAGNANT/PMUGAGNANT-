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

export async function POST(request: NextRequest) {
  if (!hasStripeConfig()) {
    return serverError(getStripeConfigError());
  }

  try {
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
      success_url: `${getSiteUrl()}/mes-paris?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getSiteUrl()}/mes-paris?subscription=cancel`,
      allow_promotion_codes: true,
      metadata: { userId: state.user.id },
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    return serverError("Stripe checkout failed", error);
  }
}
