import { getRaceTimestamp } from "@/lib/date-utils";
import type { RaceSummary } from "@/lib/types";

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

export function getPreRaceRefreshDecision(
  race: RaceSummary,
  now = new Date()
): RefreshDecision {
  const minutesUntilStart =
    (getRaceTimestamp(race.dateStr, race.heureDepart).getTime() - now.getTime()) /
    60000;

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
    return buildDecision(race, now, 5, "urgent", "fenetre-20m");
  }

  if (minutesUntilStart <= 60) {
    return buildDecision(
      race,
      now,
      race.estQuinte ? 5 : 10,
      "active",
      race.estQuinte ? "quinte-60m" : "fenetre-60m"
    );
  }

  return buildDecision(
    race,
    now,
    race.estQuinte ? 30 : 60,
    "monitor",
    race.estQuinte ? "quinte-180m" : "fenetre-180m"
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
