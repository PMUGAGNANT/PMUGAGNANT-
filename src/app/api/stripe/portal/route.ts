import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError, unauthorized } from "@/lib/api-response";
import { getRequestSubscriptionState } from "@/lib/subscription";
import {
  getSiteUrl,
  getStripeConfigError,
  getStripeServerClient,
  hasStripeConfig,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasStripeConfig()) {
    return serverError(getStripeConfigError());
  }

  try {
    const { state } = await getRequestSubscriptionState(request.headers.get("authorization"));
    if (!state.authenticated || !state.user) {
      return unauthorized("Connexion requise.");
    }

    if (!state.stripeCustomerId) {
      return badRequest("Aucun compte Stripe associe.");
    }

    const stripe = getStripeServerClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: state.stripeCustomerId,
      return_url: `${getSiteUrl()}/mes-paris`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    return serverError("Stripe portal failed", error);
  }
}
