import type { Bet } from "@/features/account/lib/bets-model";

export type AccountOverview = {
  accessBadge: string;
  focusLabel: string;
  focusTitle: string;
  focusText: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  secondaryActionLabel: string;
  secondaryActionHref: string;
};

type BuildAccountOverviewInput = {
  bets: Bet[];
  isStripeSubscribed: boolean;
  accessSource: "FREE" | "PAID" | "BONUS";
  subscriptionStatus: string;
  premiumAccessExpiresAt: string | null;
};

function hasPendingBet(bets: Bet[]) {
  return bets.some((bet) => bet.statut === "EN_ATTENTE");
}

function formatBonusWindow(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
  }).format(parsed);
}

export function buildAccountOverview({
  bets,
  isStripeSubscribed,
  accessSource,
  subscriptionStatus,
  premiumAccessExpiresAt,
}: BuildAccountOverviewInput): AccountOverview {
  const bonusWindow = formatBonusWindow(premiumAccessExpiresAt);
  const accessBadge = isStripeSubscribed
    ? `Abonnement ${subscriptionStatus}`
    : accessSource === "BONUS"
      ? "Acces bonus actif"
      : "Compte gratuit";

  if (hasPendingBet(bets)) {
    return {
      accessBadge,
      focusLabel: "Prochaine action",
      focusTitle: "Regler les tickets encore ouverts",
      focusText:
        "Tu as encore des paris en attente. Commence par verifier les resultats pour mettre le bilan a jour avant de reprendre une nouvelle course.",
      primaryActionLabel: "Verifier les tickets",
      primaryActionHref: "#settle-bets",
      secondaryActionLabel: "Voir les courses",
      secondaryActionHref: "/dashboard",
    };
  }

  if (isStripeSubscribed) {
    return {
      accessBadge,
      focusLabel: "Prochaine action",
      focusTitle: "Exploiter le compte premium a fond",
      focusText:
        "Ton acces complet est actif. Le meilleur usage maintenant, c'est d'ouvrir la prochaine course lisible, suivre la mise conseillee et laisser le compte garder la trace proprement.",
      primaryActionLabel: "Ouvrir le dashboard",
      primaryActionHref: "/dashboard",
      secondaryActionLabel: "Gerer l'abonnement",
      secondaryActionHref: "#manage-billing",
    };
  }

  if (accessSource === "BONUS") {
    return {
      accessBadge,
      focusLabel: "Prochaine action",
      focusTitle: "Profiter du bonus pendant qu'il est actif",
      focusText: bonusWindow
        ? `Ton acces bonus reste ouvert jusqu'au ${bonusWindow}. Utilise-le pour tester les tickets complets, le suivi des mises et la lecture des courses avant de passer sur l'abonnement mensuel.`
        : "Ton acces bonus est deja ouvert. Utilise-le pour tester les tickets complets, le suivi des mises et la lecture des courses avant de passer sur l'abonnement mensuel.",
      primaryActionLabel: "Voir le premium",
      primaryActionHref: "/premium",
      secondaryActionLabel: "Ouvrir le dashboard",
      secondaryActionHref: "/dashboard",
    };
  }

  return {
    accessBadge,
    focusLabel: "Prochaine action",
    focusTitle: "Passer du compte gratuit au vrai mode decision",
    focusText:
      "Ton compte est pret, mais l'etape qui change vraiment l'usage, c'est le premium : cheval conseille, mise lisible, lecture claire et bilan suivi au meme endroit.",
    primaryActionLabel: "Voir l'offre premium",
    primaryActionHref: "/premium",
    secondaryActionLabel: "Explorer les courses",
    secondaryActionHref: "/dashboard",
  };
}
