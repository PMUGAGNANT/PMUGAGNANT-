import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripePriceId = process.env.STRIPE_PRICE_ID;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

let stripeClient: Stripe | null = null;

export function hasStripeConfig() {
  return Boolean(stripeSecretKey && stripePriceId);
}

export function getStripeConfigError() {
  return "Stripe n'est pas configuré. Ajoutez STRIPE_SECRET_KEY et STRIPE_PRICE_ID.";
}

export function getStripeWebhookConfigError() {
  return "Le webhook Stripe n'est pas configuré. Ajoutez STRIPE_WEBHOOK_SECRET.";
}

export function getStripePriceId() {
  return stripePriceId ?? null;
}

export function getStripeWebhookSecret() {
  return stripeWebhookSecret ?? null;
}

export function getSiteUrl() {
  return siteUrl ?? "http://localhost:3000";
}

export function getStripeServerClient() {
  if (!hasStripeConfig()) {
    throw new Error(getStripeConfigError());
  }

  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey!, {
      apiVersion: "2026-03-25.dahlia",
    });
  }

  return stripeClient;
}
