import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const stripePriceId = process.env.STRIPE_PRICE_ID?.trim();
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const vercelSiteUrl =
  process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
  process.env.VERCEL_URL?.trim() ||
  null;

let stripeClient: Stripe | null = null;

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function isLocalhostUrl(value: string) {
  try {
    const parsed = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return value.includes("localhost");
  }
}

function isVercelProduction() {
  return process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";
}

function getResolvedSiteUrl() {
  if (siteUrl) {
    return normalizeUrl(siteUrl);
  }

  if (vercelSiteUrl) {
    return normalizeUrl(`https://${vercelSiteUrl}`);
  }

  return "http://localhost:3000";
}

function getStripeConfigIssues({ requireWebhookSecret = false }: { requireWebhookSecret?: boolean } = {}) {
  const issues: string[] = [];

  if (!stripeSecretKey) {
    issues.push("ajoutez STRIPE_SECRET_KEY");
  }

  if (!stripePriceId) {
    issues.push("ajoutez STRIPE_PRICE_ID");
  }

  if (requireWebhookSecret && !stripeWebhookSecret) {
    issues.push("ajoutez STRIPE_WEBHOOK_SECRET");
  }

  if (isVercelProduction()) {
    if (stripeSecretKey?.startsWith("sk_test_")) {
      issues.push("remplacez STRIPE_SECRET_KEY par une cle live (sk_live_)");
    }

    if (isLocalhostUrl(getResolvedSiteUrl())) {
      issues.push("remplacez NEXT_PUBLIC_SITE_URL par l'URL publique de production");
    }
  }

  return issues;
}

export function hasStripeConfig() {
  return getStripeConfigIssues().length === 0;
}

export function hasStripeWebhookConfig() {
  return getStripeConfigIssues({ requireWebhookSecret: true }).length === 0;
}

export function getStripeConfigError() {
  const issues = getStripeConfigIssues();
  return issues.length
    ? `Stripe n'est pas pret pour la production: ${issues.join(", ")}.`
    : "Stripe est correctement configure.";
}

export function getStripeWebhookConfigError() {
  const issues = getStripeConfigIssues({ requireWebhookSecret: true });
  return issues.length
    ? `Le webhook Stripe n'est pas pret: ${issues.join(", ")}.`
    : "Le webhook Stripe est correctement configure.";
}

export function getStripePriceId() {
  return stripePriceId ?? null;
}

export function getStripeWebhookSecret() {
  return stripeWebhookSecret ?? null;
}

export function getSiteUrl() {
  return getResolvedSiteUrl();
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
