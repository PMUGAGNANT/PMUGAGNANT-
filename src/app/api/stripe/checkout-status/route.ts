import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError, unauthorized } from "@/lib/api-response";
import {
  getStripeConfigError,
  getStripeServerClient,
  hasStripeConfig,
} from "@/lib/stripe";
import { getRequestSubscriptionState, isActiveSubscriptionStatus, updateSubscriptionByCustomer } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasStripeConfig()) {
    return serverError(getStripeConfigError());
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return badRequest("Session Stripe manquante.");
  }

  try {
    const { state } = await getRequestSubscriptionState(request.headers.get("authorization"));

    if (!state.authenticated || !state.user) {
      return unauthorized("Connexion requise.");
    }

    const stripe = getStripeServerClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

    if (!customerId) {
      return badRequest("Client Stripe introuvable.");
    }

    if (state.stripeCustomerId && state.stripeCustomerId !== customerId) {
      return unauthorized("Cette session Stripe ne correspond pas au compte connecte.");
    }

    const subscription =
      typeof session.subscription === "string" ? null : session.subscription ?? null;
    const subscriptionStatus = subscription?.status ?? null;
    const paymentComplete =
      session.status === "complete" &&
      (session.payment_status === "paid" || session.payment_status === "no_payment_required");
    const activated = paymentComplete || isActiveSubscriptionStatus(subscriptionStatus);

    if (activated) {
      await updateSubscriptionByCustomer(customerId, {
        stripeSubscriptionId:
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null,
        subscriptionStatus: subscriptionStatus ?? "active",
        isSubscribed: true,
      });
    }

    return NextResponse.json({
      success: true,
      activated,
      subscriptionStatus: subscriptionStatus ?? (activated ? "active" : "pending"),
      customerId,
    });
  } catch (error) {
    return serverError("Stripe checkout status failed", error, { sessionId });
  }
}
