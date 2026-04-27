import assert from "node:assert/strict";
import test from "node:test";

import { buildAccountOverview } from "../src/features/account/lib/account-overview";
import type { Bet } from "../src/features/account/lib/bets-model";

function createBet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: "bet-1",
    date_str: "2026-04-23",
    reunion: 1,
    course: 1,
    hippodrome: "Auteuil",
    heure_depart: "15:40",
    cheval_num: 7,
    cheval_nom: "Falco",
    type_pari: "GAGNANT",
    mise: 8,
    cote: 4.2,
    statut: "EN_ATTENTE",
    gain: null,
    created_at: "2026-04-23T09:00:00.000Z",
    ...overrides,
  };
}

test("account overview priorise les tickets en attente", () => {
  const overview = buildAccountOverview({
    bets: [createBet()],
    isStripeSubscribed: false,
    accessSource: "FREE",
    subscriptionStatus: "FREE",
    premiumAccessExpiresAt: null,
  });

  assert.equal(overview.primaryActionHref, "#settle-bets");
  assert.match(overview.focusTitle, /tickets/i);
});

test("account overview pousse vers le dashboard quand le premium est actif", () => {
  const overview = buildAccountOverview({
    bets: [createBet({ statut: "GAGNE", gain: 33.6 })],
    isStripeSubscribed: true,
    accessSource: "PAID",
    subscriptionStatus: "active",
    premiumAccessExpiresAt: null,
  });

  assert.equal(overview.primaryActionHref, "/dashboard");
  assert.equal(overview.secondaryActionHref, "#manage-billing");
});

test("account overview pousse vers premium sur un compte gratuit", () => {
  const overview = buildAccountOverview({
    bets: [],
    isStripeSubscribed: false,
    accessSource: "FREE",
    subscriptionStatus: "FREE",
    premiumAccessExpiresAt: null,
  });

  assert.equal(overview.primaryActionHref, "/premium");
  assert.match(overview.focusText, /premium/i);
});
