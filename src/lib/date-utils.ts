const PARIS_TIME_ZONE = "Europe/Paris";

function getParisIsoDate(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getParisParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday"),
  };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  });
  const timeZoneName =
    formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = timeZoneName.match(/^GMT(?:(\+|-)(\d{1,2})(?::?(\d{2}))?)?$/);

  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours * 60 + minutes);
}

function getParisDateFromParts(year: number, month: number, day: number, hours = 0, minutes = 0) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, PARIS_TIME_ZONE);
  return new Date(utcGuess.getTime() - offsetMinutes * 60_000);
}

export function getParisNow(): Date {
  return new Date();
}

export function formatDateToPmu(date: Date): string {
  const { day, month, year } = getParisParts(date);
  return `${String(day).padStart(2, "0")}${String(month).padStart(2, "0")}${year}`;
}

export function parsePmuDate(dateStr: string): Date {
  const day = Number.parseInt(dateStr.slice(0, 2), 10);
  const month = Number.parseInt(dateStr.slice(2, 4), 10) - 1;
  const year = Number.parseInt(dateStr.slice(4, 8), 10);
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

export function toIsoDate(dateStr: string): string {
  const day = dateStr.slice(0, 2);
  const month = dateStr.slice(2, 4);
  const year = dateStr.slice(4, 8);
  return `${year}-${month}-${day}`;
}

export function fromIsoDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${String(day).padStart(2, "0")}${String(month).padStart(2, "0")}${year}`;
}

export function getTodayDateStr(): string {
  const [year, month, day] = getParisIsoDate(new Date()).split("-");
  return `${day}${month}${year}`;
}

export function getMinutesUntilStart(heureDepart: string, dateStr?: string): number {
  const now = new Date();

  if (dateStr) {
    const target = getRaceTimestamp(dateStr, heureDepart);
    return (target.getTime() - now.getTime()) / 60000;
  }

  const parisNow = getParisParts(now);
  const [hours, minutes] = heureDepart.split(":").map(Number);
  const target = getParisDateFromParts(
    parisNow.year,
    parisNow.month,
    parisNow.day,
    hours,
    minutes
  );
  return (target.getTime() - now.getTime()) / 60000;
}

export function getRaceTimestamp(dateStr: string, heureDepart: string): Date {
  const day = Number.parseInt(dateStr.slice(0, 2), 10);
  const month = Number.parseInt(dateStr.slice(2, 4), 10);
  const year = Number.parseInt(dateStr.slice(4, 8), 10);
  const [hours, minutes] = heureDepart.split(":").map(Number);
  return getParisDateFromParts(year, month, day, hours, minutes);
}

export function getWeekBounds(reference = getParisNow()) {
  const parisReference = getParisParts(reference);
  const weekdayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const diffToMonday = weekdayMap[parisReference.weekday] ?? 0;
  const mondayUtc = new Date(
    Date.UTC(parisReference.year, parisReference.month - 1, parisReference.day, 12, 0, 0, 0)
  );
  mondayUtc.setUTCDate(mondayUtc.getUTCDate() - diffToMonday);

  const start = getParisDateFromParts(
    mondayUtc.getUTCFullYear(),
    mondayUtc.getUTCMonth() + 1,
    mondayUtc.getUTCDate(),
    0,
    0
  );
  const end = getParisDateFromParts(
    mondayUtc.getUTCFullYear(),
    mondayUtc.getUTCMonth() + 1,
    mondayUtc.getUTCDate() + 6,
    23,
    59
  );

  const startParts = getParisParts(start);
  const endParts = getParisParts(end);

  return {
    start,
    end,
    startIso: `${startParts.year}-${String(startParts.month).padStart(2, "0")}-${String(
      startParts.day
    ).padStart(2, "0")}`,
    endIso: `${endParts.year}-${String(endParts.month).padStart(2, "0")}-${String(
      endParts.day
    ).padStart(2, "0")}`,
  };
}

export function listRecentPmuDates(days: number, reference = getParisNow()) {
  const safeDays = Math.max(1, Math.floor(days));
  const dates: string[] = [];
  const cursor = new Date(reference);

  for (let offset = 0; offset < safeDays; offset += 1) {
    const next = new Date(cursor);
    next.setDate(cursor.getDate() - offset);
    dates.push(formatDateToPmu(next));
  }

  return dates.reverse();
}
