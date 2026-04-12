import "./load-env";
import { formatDateToPmu, parsePmuDate } from "../src/lib/date-utils";

function getFlag(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function isValidPmuDate(value: string | null): value is string {
  return Boolean(value && /^\d{8}$/.test(value));
}

function buildDateRange(start: string, end: string) {
  const dates: string[] = [];
  const cursor = parsePmuDate(start);
  const endDate = parsePmuDate(end);

  while (cursor.getTime() <= endDate.getTime()) {
    dates.push(formatDateToPmu(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const start = getFlag("start");
  const end = getFlag("end");

  if (!isValidPmuDate(start) || !isValidPmuDate(end)) {
    throw new Error("Paramètres requis : --start=DDMMYYYY --end=DDMMYYYY");
  }

  const startDate = parsePmuDate(start);
  const endDate = parsePmuDate(end);
  if (startDate.getTime() > endDate.getTime()) {
    throw new Error("La date de début doit être antérieure ou égale à la date de fin.");
  }

  process.env.TELEGRAM_BOT_TOKEN = "";

  const { runMorningAnalysis, runResultSync } = await import("../src/lib/prediction-pipeline");

  const dates = buildDateRange(start, end);
  const failures: Array<{ date: string; step: "morning" | "results"; error: string }> = [];

  process.stdout.write(`Backfill historique du ${start} au ${end} (${dates.length} jours)\n`);

  for (const [index, dateStr] of dates.entries()) {
    let morningCourses: number | null = null;
    let settledCourses: number | null = null;

    try {
      const morning = await runMorningAnalysis(dateStr);
      morningCourses = morning.racesProcessed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ date: dateStr, step: "morning", error: message });
      process.stderr.write(`[${index + 1}/${dates.length}] ${dateStr} — erreur analyse matin: ${message}\n`);
    }

    try {
      const synced = await runResultSync(dateStr);
      settledCourses = synced.racesProcessed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ date: dateStr, step: "results", error: message });
      process.stderr.write(`[${index + 1}/${dates.length}] ${dateStr} — erreur sync résultats: ${message}\n`);
    }

    const displayedCourses = morningCourses ?? settledCourses ?? 0;
    const details = [
      morningCourses !== null ? `matin ${morningCourses}` : null,
      settledCourses !== null ? `résultats ${settledCourses}` : null,
    ]
      .filter(Boolean)
      .join(" • ");
    process.stdout.write(
      `[${index + 1}/${dates.length}] ${dateStr} — ${displayedCourses} courses${details ? ` (${details})` : ""}\n`
    );

    if (index < dates.length - 1) {
      await sleep(2_000);
    }
  }

  if (failures.length > 0) {
    process.stdout.write(`Backfill terminé avec ${failures.length} erreur(s).\n`);
    failures.forEach((failure) => {
      process.stdout.write(`- ${failure.date} [${failure.step}] ${failure.error}\n`);
    });
    return;
  }

  process.stdout.write("Backfill terminé sans erreur.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
