import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api-response";
import {
  getStripeServerClient,
  getStripeWebhookConfigError,
  getStripeWebhookSecret,
} from "@/lib/stripe";
import { isActiveSubscriptionStatus, updateSubscriptionByCustomer } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = getStripeWebhookSecret();

  if (!signature || !webhookSecret) {
    return serverError(getStripeWebhookConfigError());
  }

  try {
    const rawBody = await request.text();
    const stripe = getStripeServerClient();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        if (customerId) {
          await updateSubscriptionByCustomer(customerId, {
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: "active",
            isSubscribed: true,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        const status = subscription.status ?? "canceled";

        await updateSubscriptionByCustomer(customerId, {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: status,
          isSubscribed: isActiveSubscriptionStatus(status),
        });
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return serverError("Stripe webhook failed", error);
  }
}
