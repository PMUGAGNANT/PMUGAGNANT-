export interface UserBetOutcomeRow {
  id?: string | null;
  date_str?: string | null;
  created_at?: string | null;
  statut?: string | null;
}

export interface UserStreakSnapshot {
  current_streak: number;
  best_streak: number;
  total_followed: number;
  total_won: number;
  win_rate: number;
  badge: string;
  badge_emoji: string;
  next_badge: string | null;
  next_badge_threshold: number | null;
}

export interface UserBadgeTier {
  label: string;
  emoji: string;
  threshold: number;
}

export const USER_BADGE_TIERS: UserBadgeTier[] = [
  { label: "DEBUTANT", emoji: "🌱", threshold: 0 },
  { label: "REGULIER", emoji: "⭐", threshold: 5 },
  { label: "CONFIRME", emoji: "🏆", threshold: 20 },
  { label: "EXPERT", emoji: "💎", threshold: 50 },
  { label: "LEGENDE", emoji: "👑", threshold: 100 },
];

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function isWinningBetStatus(status: string | null | undefined) {
  return status === "GAGNE" || status === "PLACE";
}

export function isSettledBetStatus(status: string | null | undefined) {
  return status === "GAGNE" || status === "PLACE" || status === "PERDU";
}

export function compareBetRowsNewest(left: UserBetOutcomeRow, right: UserBetOutcomeRow) {
  const leftDate = left.date_str ?? "";
  const rightDate = right.date_str ?? "";
  if (rightDate !== leftDate) {
    return rightDate.localeCompare(leftDate);
  }

  const leftCreated = left.created_at ?? "";
  const rightCreated = right.created_at ?? "";
  if (rightCreated !== leftCreated) {
    return rightCreated.localeCompare(leftCreated);
  }

  return (right.id ?? "").localeCompare(left.id ?? "");
}

export function getBadgeTier(totalWon: number) {
  let current = USER_BADGE_TIERS[0]!;

  for (const tier of USER_BADGE_TIERS) {
    if (totalWon >= tier.threshold) {
      current = tier;
    }
  }

  const currentIndex = USER_BADGE_TIERS.findIndex((tier) => tier.label === current.label);
  const next = currentIndex >= 0 ? USER_BADGE_TIERS[currentIndex + 1] ?? null : null;
  const previous = currentIndex > 0 ? USER_BADGE_TIERS[currentIndex - 1] ?? USER_BADGE_TIERS[0]! : USER_BADGE_TIERS[0]!;

  return {
    current,
    previous,
    next,
  };
}

export function calculateStreaksFromBets(bets: UserBetOutcomeRow[]) {
  const total_followed = bets.length;
  const total_won = bets.filter((bet) => isWinningBetStatus(bet.statut)).length;
  const settled = [...bets].filter((bet) => isSettledBetStatus(bet.statut)).sort(compareBetRowsNewest);

  let current_streak = 0;
  for (const bet of settled) {
    if (!isWinningBetStatus(bet.statut)) {
      break;
    }
    current_streak += 1;
  }

  const chronological = [...settled].reverse();
  let best_streak = 0;
  let active = 0;

  for (const bet of chronological) {
    if (isWinningBetStatus(bet.statut)) {
      active += 1;
      if (active > best_streak) {
        best_streak = active;
      }
      continue;
    }

    active = 0;
  }

  return {
    current_streak,
    best_streak,
    total_followed,
    total_won,
  };
}

export function createUserStreakSnapshot(
  partial?: Partial<UserStreakSnapshot>
): UserStreakSnapshot {
  const totalWon = partial?.total_won ?? 0;
  const totalFollowed = partial?.total_followed ?? 0;
  const badgeMeta = getBadgeTier(totalWon);

  return {
    current_streak: partial?.current_streak ?? 0,
    best_streak: partial?.best_streak ?? 0,
    total_followed: totalFollowed,
    total_won: totalWon,
    win_rate:
      partial?.win_rate ??
      (totalFollowed > 0 ? round1((totalWon / totalFollowed) * 100) : 0),
    badge: partial?.badge ?? badgeMeta.current.label,
    badge_emoji: partial?.badge_emoji ?? badgeMeta.current.emoji,
    next_badge: partial?.next_badge ?? badgeMeta.next?.label ?? null,
    next_badge_threshold: partial?.next_badge_threshold ?? badgeMeta.next?.threshold ?? null,
  };
}

export function getBadgeProgress(totalWon: number, nextThreshold: number | null) {
  if (!nextThreshold) {
    return 100;
  }

  const { previous } = getBadgeTier(totalWon);
  const currentThreshold = previous.threshold;
  const span = Math.max(nextThreshold - currentThreshold, 1);
  const progress = ((totalWon - currentThreshold) / span) * 100;

  return Math.max(0, Math.min(100, progress));
}
