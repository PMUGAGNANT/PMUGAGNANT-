import { getRaceTimestamp } from "@/lib/date-utils";
import type { RaceSummary } from "@/lib/types";

export type RefreshPriorityHints = {
  hasPlayableSignal?: boolean;
  hasWatchSignal?: boolean;
  hasStrongOddsVariation?: boolean;
};

export type RefreshDecision = {
  due: boolean;
  intervalMinutes: number | null;
  minutesUntilStart: number;
  lane: "idle" | "monitor" | "active" | "urgent" | "settlement";
  reason: string;
};

function getParisMinuteOfDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function isAlignedToInterval(now: Date, intervalMinutes: number) {
  if (intervalMinutes <= 5) {
    return true;
  }

  return getParisMinuteOfDay(now) % intervalMinutes === 0;
}

function buildDecision(
  race: RaceSummary,
  now: Date,
  intervalMinutes: number | null,
  lane: RefreshDecision["lane"],
  reason: string
): RefreshDecision {
  const minutesUntilStart =
    (getRaceTimestamp(race.dateStr, race.heureDepart).getTime() - now.getTime()) /
    60000;
  return {
    due:
      intervalMinutes === null ? false : isAlignedToInterval(now, intervalMinutes),
    intervalMinutes,
    minutesUntilStart,
    lane,
    reason,
  };
}

function getPriorityProfile(race: RaceSummary, hints?: RefreshPriorityHints) {
  const hasPlayableSignal = Boolean(hints?.hasPlayableSignal);
  const hasStrongOddsVariation = Boolean(hints?.hasStrongOddsVariation);
  const isPriorityRace =
    race.estQuinte || hasPlayableSignal || hasStrongOddsVariation;

  return {
    isPriorityRace,
    reasonTag: race.estQuinte
      ? "quinte"
      : hasPlayableSignal
        ? "signal-valide"
        : hasStrongOddsVariation
          ? "variation-forte"
          : "standard",
  };
}

export function getPreRaceRefreshDecision(
  race: RaceSummary,
  now = new Date(),
  hints?: RefreshPriorityHints
): RefreshDecision {
  const minutesUntilStart =
    (getRaceTimestamp(race.dateStr, race.heureDepart).getTime() - now.getTime()) /
    60000;
  const priority = getPriorityProfile(race, hints);

  if (minutesUntilStart < -15) {
    return {
      due: false,
      intervalMinutes: null,
      minutesUntilStart,
      lane: "idle",
      reason: "depart-passe",
    };
  }

  if (minutesUntilStart > 180) {
    return {
      due: false,
      intervalMinutes: null,
      minutesUntilStart,
      lane: "idle",
      reason: "trop-loin",
    };
  }

  if (minutesUntilStart <= 20) {
    return buildDecision(
      race,
      now,
      5,
      "urgent",
      priority.isPriorityRace ? `${priority.reasonTag}-20m` : "fenetre-20m"
    );
  }

  if (minutesUntilStart <= 60) {
    if (priority.isPriorityRace) {
      return buildDecision(race, now, 5, "active", `${priority.reasonTag}-60m`);
    }

    return buildDecision(
      race,
      now,
      10,
      "active",
      "fenetre-60m"
    );
  }

  if (priority.isPriorityRace) {
    return buildDecision(race, now, 30, "monitor", `${priority.reasonTag}-180m`);
  }

  return buildDecision(
    race,
    now,
    60,
    "monitor",
    "fenetre-180m"
  );
}

export function getResultRefreshDecision(
  race: RaceSummary,
  now = new Date()
): RefreshDecision {
  const minutesUntilStart =
    (getRaceTimestamp(race.dateStr, race.heureDepart).getTime() - now.getTime()) /
    60000;

  if (minutesUntilStart >= -10) {
    return {
      due: false,
      intervalMinutes: null,
      minutesUntilStart,
      lane: "idle",
      reason: "avant-resultat",
    };
  }

  if (minutesUntilStart >= -45) {
    return buildDecision(race, now, 5, "settlement", "resultat-chaud");
  }

  if (minutesUntilStart >= -180) {
    return buildDecision(race, now, 10, "settlement", "resultat-standard");
  }

  return {
    due: false,
    intervalMinutes: null,
    minutesUntilStart,
    lane: "idle",
    reason: "resultat-trop-loin",
  };
}
