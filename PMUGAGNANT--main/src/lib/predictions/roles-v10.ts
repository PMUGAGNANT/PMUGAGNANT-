import type { ScoreV10Breakdown } from "@/lib/predictions/scoring-v10";

export type RaceRoleV10Key = "CHOIX" | "PEPITE" | "CHASSEUR" | "PODIUM" | "OUTSIDER";

export interface RaceRoleV10Selection {
  role: RaceRoleV10Key;
  label: string;
  emoji: string;
  chevalNum: number;
  chevalNom: string;
  scoreV10: number;
  scoreC1: number;
  scoreC3: number;
  scoreC4: number;
  cote: number | null;
  jockey: string | null;
  jockeyWinRate: number | null;
  betType: "GAGNANT" | "PLACE";
}

const ROLE_META: Record<RaceRoleV10Key, { label: string; emoji: string }> = {
  CHOIX: { label: "CHOIX", emoji: "🎯" },
  PEPITE: { label: "PÉPITE", emoji: "💎" },
  CHASSEUR: { label: "CHASSEUR", emoji: "🏹" },
  PODIUM: { label: "PODIUM", emoji: "🥉" },
  OUTSIDER: { label: "OUTSIDER", emoji: "⚡" },
};

function toRoleSelection(
  role: RaceRoleV10Key,
  score: ScoreV10Breakdown,
  betType: "GAGNANT" | "PLACE" = "GAGNANT"
): RaceRoleV10Selection {
  const meta = ROLE_META[role];
  return {
    role,
    label: meta.label,
    emoji: meta.emoji,
    chevalNum: score.chevalNum,
    chevalNom: score.chevalNom,
    scoreV10: score.scoreV10,
    scoreC1: score.scoreC1,
    scoreC3: score.scoreC3,
    scoreC4: score.scoreC4,
    cote: score.cote,
    jockey: score.jockey,
    jockeyWinRate: score.jockeyWinRate,
    betType,
  };
}

function bestBy<T>(items: T[], score: (item: T) => number) {
  return items
    .slice()
    .sort((left, right) => score(right) - score(left))[0] ?? null;
}

function hasUsableOdds(score: ScoreV10Breakdown): score is ScoreV10Breakdown & { cote: number } {
  return typeof score.cote === "number" && Number.isFinite(score.cote) && score.cote > 0;
}

export function selectRaceRolesV10(scores: ScoreV10Breakdown[]): RaceRoleV10Selection[] {
  const available = scores
    .filter((score) => Number.isFinite(score.scoreV10))
    .slice()
    .sort((left, right) => {
      if (right.scoreV10 !== left.scoreV10) return right.scoreV10 - left.scoreV10;
      return (left.cote ?? 999) - (right.cote ?? 999);
    });

  const choix = available[0] ?? null;
  if (!choix) {
    return [];
  }

  const used = new Set<number>([choix.chevalNum]);
  const roles: RaceRoleV10Selection[] = [toRoleSelection("CHOIX", choix)];

  const remaining = () => available.filter((score) => !used.has(score.chevalNum));

  const pepite = bestBy(
    remaining().filter(
      (score) =>
        hasUsableOdds(score) &&
        score.cote >= 6 &&
        score.cote <= 15 &&
        score.scoreC1 >= 10 &&
        score.scoreV10 >= 45
    ),
    (score) => score.scoreV10
  );
  if (pepite) {
    used.add(pepite.chevalNum);
    roles.push(toRoleSelection("PEPITE", pepite));
  }

  const chasseur = hasUsableOdds(choix)
    ? bestBy(
        remaining().filter((score) => hasUsableOdds(score) && score.cote < choix.cote),
        (score) => score.scoreC3
      )
    : null;
  if (chasseur) {
    used.add(chasseur.chevalNum);
    roles.push(toRoleSelection("CHASSEUR", chasseur));
  }

  const podium = bestBy(remaining(), (score) => score.scoreC4);
  if (podium) {
    used.add(podium.chevalNum);
    roles.push(toRoleSelection("PODIUM", podium, "PLACE"));
  }

  const outsider = bestBy(
    remaining().filter(
      (score) => hasUsableOdds(score) && score.cote > 10 && score.scoreC1 >= 18
    ),
    (score) => score.scoreV10
  );
  if (outsider) {
    roles.push(toRoleSelection("OUTSIDER", outsider));
  }

  return roles;
}

export function getRaceRoleV10Meta(role: RaceRoleV10Key) {
  return ROLE_META[role];
}
