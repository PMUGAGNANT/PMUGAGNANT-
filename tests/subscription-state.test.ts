import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSubscriptionStateFromProfile,
  hasActivePremiumBonus,
} from "../src/lib/subscription";

test("hasActivePremiumBonus détecte une fenêtre premium bonus active", () => {
  const now = new Date("2026-04-08T12:00:00.000Z");

  assert.equal(
    hasActivePremiumBonus("2026-04-15T12:00:00.000Z", now),
    true
  );
  assert.equal(
    hasActivePremiumBonus("2026-04-07T12:00:00.000Z", now),
    false
  );
  assert.equal(hasActivePremiumBonus(null, now), false);
});

test("buildSubscriptionStateFromProfile donne accès via bonus même sans abonnement Stripe", () => {
  const now = new Date("2026-04-08T12:00:00.000Z");
  const state = buildSubscriptionStateFromProfile(
    {
      is_subscribed: false,
      subscription_status: "FREE",
      stripe_customer_id: null,
      premium_access_expires_at: "2026-04-12T12:00:00.000Z",
    },
    null,
    now
  );

  assert.equal(state.isSubscribed, true);
  assert.equal(state.isStripeSubscribed, false);
  assert.equal(state.accessSource, "BONUS");
  assert.equal(state.subscriptionStatus, "BONUS");
});

test("buildSubscriptionStateFromProfile privilégie l'abonnement Stripe quand il est actif", () => {
  const now = new Date("2026-04-08T12:00:00.000Z");
  const state = buildSubscriptionStateFromProfile(
    {
      is_subscribed: true,
      subscription_status: "active",
      stripe_customer_id: "cus_123",
      premium_access_expires_at: "2026-04-12T12:00:00.000Z",
    },
    null,
    now
  );

  assert.equal(state.isSubscribed, true);
  assert.equal(state.isStripeSubscribed, true);
  assert.equal(state.accessSource, "PAID");
  assert.equal(state.subscriptionStatus, "active");
  assert.equal(state.stripeCustomerId, "cus_123");
});
