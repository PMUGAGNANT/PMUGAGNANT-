export interface ParticipantBase {
  cheval_num: number;
  cheval_nom: string;
  cote_matin: number;
  cote_depart?: number | null;
  score_cheval: number;
  confiance: number;
  non_partant?: boolean;
}

export type RoleId = "FAVORI" | "PEPITE" | "OUTSIDER" | "OUBLIE";
export type TypeRoleCheval = RoleId;
export type LisibiliteRoleCheval = "LISIBLE" | "COMPLEXE" | "LOTERIE";

export interface RoleCheval {
  role: TypeRoleCheval;
  emoji: string;
  label: string;
  cheval_num: number;
  cheval_nom: string;
  cote: number;
  score_cheval: number;
  confiance: number;
  raison: string;
  variation_cote: number | null;
}

const ROLE_META: Record<TypeRoleCheval, Pick<RoleCheval, "emoji" | "label">> = {
  FAVORI: { emoji: "⭐", label: "Favori" },
  PEPITE: { emoji: "💎", label: "Pépite" },
  OUTSIDER: { emoji: "🚀", label: "Outsider" },
  OUBLIE: { emoji: "🫥", label: "Oublié" },
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function variationCote(participant: ParticipantBase) {
  if (
    !isFiniteNumber(participant.cote_matin) ||
    participant.cote_matin <= 0 ||
    !isFiniteNumber(participant.cote_depart)
  ) {
    return null;
  }

  return ((participant.cote_depart - participant.cote_matin) / participant.cote_matin) * 100;
}

function getRoleReason(role: TypeRoleCheval, participant: ParticipantBase) {
  const variation = variationCote(participant);

  switch (role) {
    case "FAVORI":
      return "Cote du matin la plus basse.";
    case "PEPITE":
      return `Score ${Math.round(participant.score_cheval)}/100 avec cote > 6.`;
    case "OUTSIDER":
      return variation !== null
        ? `Baisse de cote ${Math.round(variation)}% depuis le matin.`
        : "Signal marche en baisse nette.";
    case "OUBLIE":
      return "Score solide sans signal marche fort.";
  }
}

function toRole(role: TypeRoleCheval, participant: ParticipantBase): RoleCheval {
  return {
    role,
    emoji: ROLE_META[role].emoji,
    label: ROLE_META[role].label,
    cheval_num: participant.cheval_num,
    cheval_nom: participant.cheval_nom,
    cote: participant.cote_matin,
    score_cheval: participant.score_cheval,
    confiance: participant.confiance,
    raison: getRoleReason(role, participant),
    variation_cote: variationCote(participant),
  };
}

function byHorseNumber(left: ParticipantBase, right: ParticipantBase) {
  return left.cheval_num - right.cheval_num;
}

function isAvailable(participant: ParticipantBase) {
  return (
    participant.non_partant !== true &&
    Number.isInteger(participant.cheval_num) &&
    participant.cheval_num > 0 &&
    isFiniteNumber(participant.cote_matin) &&
    isFiniteNumber(participant.score_cheval) &&
    isFiniteNumber(participant.confiance)
  );
}

export function detecterRoles(
  participants: ParticipantBase[],
  lisibilite?: LisibiliteRoleCheval | null
): RoleCheval[] {
  const partants = participants.filter(isAvailable);
  const roles: RoleCheval[] = [];
  const dejaRetenus = new Set<number>();

  const favori = [...partants].sort(
    (left, right) => left.cote_matin - right.cote_matin || byHorseNumber(left, right)
  )[0];

  if (!favori) {
    return roles;
  }

  roles.push(toRole("FAVORI", favori));
  dejaRetenus.add(favori.cheval_num);

  if (lisibilite !== "LOTERIE") {
    const pepite = partants
      .filter(
        (participant) =>
          !dejaRetenus.has(participant.cheval_num) &&
          participant.cote_matin > 6.0 &&
          participant.score_cheval >= 60
      )
      .sort(
        (left, right) =>
          right.score_cheval - left.score_cheval ||
          right.confiance - left.confiance ||
          right.cote_matin - left.cote_matin ||
          byHorseNumber(left, right)
      )[0];

    if (pepite) {
      roles.push(toRole("PEPITE", pepite));
      dejaRetenus.add(pepite.cheval_num);
    }
  }

  const outsider = partants
    .filter((participant) => {
      const variation = variationCote(participant);

      return (
        !dejaRetenus.has(participant.cheval_num) &&
        participant.cote_matin > 10 &&
        variation !== null &&
        variation <= -15
      );
    })
    .sort((left, right) => {
      const leftVariation = variationCote(left) ?? 0;
      const rightVariation = variationCote(right) ?? 0;

      return (
        leftVariation - rightVariation ||
        right.score_cheval - left.score_cheval ||
        right.confiance - left.confiance ||
        byHorseNumber(left, right)
      );
    })[0];

  if (outsider) {
    roles.push(toRole("OUTSIDER", outsider));
    dejaRetenus.add(outsider.cheval_num);
  }

  const oublie = partants
    .filter((participant) => {
      const variation = variationCote(participant);

      return (
        !dejaRetenus.has(participant.cheval_num) &&
        participant.cote_matin > 15 &&
        participant.score_cheval >= 65 &&
        variation !== null &&
        variation > -15
      );
    })
    .sort(
      (left, right) =>
        right.score_cheval - left.score_cheval ||
        right.confiance - left.confiance ||
        right.cote_matin - left.cote_matin ||
        byHorseNumber(left, right)
    )[0];

  if (oublie) {
    roles.push(toRole("OUBLIE", oublie));
  }

  return roles;
}
