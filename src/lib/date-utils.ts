const PARIS_TIME_ZONE = "Europe/Paris";

export function getParisNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: PARIS_TIME_ZONE }));
}

export function formatDateToPmu(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}

export function parsePmuDate(dateStr: string): Date {
  const day = Number.parseInt(dateStr.slice(0, 2), 10);
  const month = Number.parseInt(dateStr.slice(2, 4), 10) - 1;
  const year = Number.parseInt(dateStr.slice(4, 8), 10);
  return new Date(year, month, day);
}

export function toIsoDate(dateStr: string): string {
  const date = parsePmuDate(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function fromIsoDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${String(day).padStart(2, "0")}${String(month).padStart(2, "0")}${year}`;
}

export function getTodayDateStr(): string {
  return formatDateToPmu(getParisNow());
}

export function getMinutesUntilStart(heureDepart: string, dateStr?: string): number {
  const parisNow = getParisNow();

  if (dateStr) {
    const target = getRaceTimestamp(dateStr, heureDepart);
    return (target.getTime() - parisNow.getTime()) / 60000;
  }

  const [hours, minutes] = heureDepart.split(":").map(Number);
  const target = new Date(parisNow);
  target.setHours(hours, minutes, 0, 0);
  return (target.getTime() - parisNow.getTime()) / 60000;
}

export function getRaceTimestamp(dateStr: string, heureDepart: string): Date {
  const date = parsePmuDate(dateStr);
  const [hours, minutes] = heureDepart.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function getWeekBounds(reference = getParisNow()) {
  const date = new Date(reference);
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
    startIso: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(
      start.getDate()
    ).padStart(2, "0")}`,
    endIso: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(
      end.getDate()
    ).padStart(2, "0")}`,
  };
}
