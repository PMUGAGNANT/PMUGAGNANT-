import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { analyzeRace } from '../src/lib/analysis';
import { getAllRaces, getDefinitiveRapports, getParticipants, getTodayDateStr } from '../src/lib/pmu-api';
import {
  buildPredictionHistoryRecords,
  getActiveModelWeightProfile,
  storePredictionHistory,
} from '../src/lib/learning';
import { createSupabaseAdminClient } from '../src/lib/supabase';
import type { PredictionHistoryRecord, RaceSummary } from '../src/lib/types';

function parseDaysArg() {
  const fromInline = process.argv.find((entry) => entry.startsWith('--days='))?.split('=')[1];
  const fromPairIndex = process.argv.findIndex((entry) => entry === '--days');
  const fromPair = fromPairIndex >= 0 ? process.argv[fromPairIndex + 1] : undefined;
  const fromEnv = process.env.LEARN_DAYS;
  const parsed = Number(fromInline ?? fromPair ?? fromEnv ?? 365);
  if (!Number.isFinite(parsed) || parsed <= 0) return 365;
  return Math.min(parsed, 1095);
}

function hasDryRunFlag() {
  return process.argv.includes('--dry-run') || process.env.LEARN_DRY_RUN === '1';
}

function getArgValue(name: string) {
  const fromInline = process.argv.find((entry) => entry.startsWith(`--${name}=`))?.split('=')[1];
  const fromPairIndex = process.argv.findIndex((entry) => entry === `--${name}`);
  const fromPair = fromPairIndex >= 0 ? process.argv[fromPairIndex + 1] : undefined;
  return fromInline ?? fromPair;
}

function getOutputPath() {
  const fromEnv = process.env.LEARN_OUTPUT_FILE;

  return getArgValue('output') ?? fromEnv ?? path.join(process.cwd(), 'scripts', 'output', 'prediction-history.json');
}

function getDateArg(name: 'start' | 'end') {
  const value = getArgValue(name);
  return value && /^\d{8}$/.test(value) ? value : null;
}

function formatDateStr(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}

function parseDateStr(value: string) {
  return new Date(
    Number(value.slice(4, 8)),
    Number(value.slice(2, 4)) - 1,
    Number(value.slice(0, 2))
  );
}

function buildDateWindow(days: number, startDateStr?: string | null, endDateStr?: string | null) {
  if (startDateStr && endDateStr) {
    const start = parseDateStr(startDateStr);
    const end = parseDateStr(endDateStr);
    const dates: string[] = [];

    for (const current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
      dates.push(formatDateStr(current));
    }

    return dates;
  }

  const todayStr = getTodayDateStr();
  const today = parseDateStr(todayStr);

  return Array.from({ length: days }, (_, index) => {
    const current = new Date(today);
    current.setDate(today.getDate() - index - 1);
    return formatDateStr(current);
  }).reverse();
}

async function retry<T>(label: string, task: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      console.warn(`${label}: tentative ${attempt}/${attempts} echouee.`);
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError;
}

function getRecordKey(record: PredictionHistoryRecord) {
  return [
    record.dateStr,
    record.reunion,
    record.course,
    record.pariType,
    record.recommendationRank,
    record.recommendedHorse1Num,
    record.recommendedHorse2Num ?? 'none',
  ].join('|');
}

async function loadExistingRecords(outputPath: string) {
  try {
    const fileData = await readFile(outputPath, 'utf8');
    const parsed = JSON.parse(fileData) as PredictionHistoryRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function collectDayHistory(dateStr: string) {
  const races = await retry(`Races ${dateStr}`, () => getAllRaces(dateStr));
  const [flatWeights, trotWeights] = await Promise.all([
    getActiveModelWeightProfile('PLAT'),
    getActiveModelWeightProfile('TROT'),
  ]);

  const records: PredictionHistoryRecord[] = [];

  for (const race of races) {
    try {
      const [participants, definitiveRapports] = await Promise.all([
        retry(
          `Participants ${dateStr} R${race.reunion}C${race.course}`,
          () => getParticipants(dateStr, race.reunion, race.course)
        ),
        retry(
          `Rapports ${dateStr} R${race.reunion}C${race.course}`,
          () => getDefinitiveRapports(dateStr, race.reunion, race.course),
          2
        ).catch(() => ({})),
      ]);

      if (participants.length === 0) continue;

      const analysis = analyzeRace(
        race as RaceSummary,
        participants,
        race.estPlat ? flatWeights : trotWeights
      );
      records.push(
        ...buildPredictionHistoryRecords(
          dateStr,
          race as RaceSummary,
          participants,
          analysis,
          definitiveRapports
        )
      );
    } catch (error) {
      console.warn(`Jour ${dateStr} ignore:`, error instanceof Error ? error.message : error);
    }
  }

  return records;
}

async function main() {
  const days = parseDaysArg();
  const dryRun = hasDryRunFlag();
  const outputPath = getOutputPath();
  const hasAdmin = Boolean(createSupabaseAdminClient());
  const startDateStr = getDateArg('start');
  const endDateStr = getDateArg('end');
  const dates = buildDateWindow(days, startDateStr, endDateStr);
  const allRecords: PredictionHistoryRecord[] = dryRun ? [] : await loadExistingRecords(outputPath);
  const knownRecordKeys = new Set(allRecords.map(getRecordKey));
  const processedDates = new Set(allRecords.map((record) => record.dateStr));

  console.log(`Backfill apprentissage sur ${dates.length} jour(s)${dryRun ? ' (dry-run)' : ''}...`);
  if (!dryRun && allRecords.length > 0) {
    console.log(`Reprise detectee: ${allRecords.length} prediction(s) deja presentes.`);
  }

  let totalRecords = 0;
  for (const dateStr of dates) {
    if (!dryRun && processedDates.has(dateStr)) {
      console.log(`${dateStr}: deja traite, saute.`);
      continue;
    }

    let records: PredictionHistoryRecord[] = [];
    try {
      records = await collectDayHistory(dateStr);
    } catch (error) {
      console.warn(`Jour ${dateStr} ignore apres plusieurs echecs:`, error instanceof Error ? error.message : error);
      continue;
    }

    totalRecords += records.length;

    if (!dryRun && hasAdmin && records.length > 0) {
      await storePredictionHistory(records);
    }

    if (!dryRun && records.length > 0) {
      for (const record of records) {
        const recordKey = getRecordKey(record);
        if (knownRecordKeys.has(recordKey)) continue;
        knownRecordKeys.add(recordKey);
        allRecords.push(record);
      }
    }

    if (!dryRun) {
      processedDates.add(dateStr);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, JSON.stringify(allRecords, null, 2), 'utf8');
    }

    console.log(`${dateStr}: ${records.length} prediction(s) capturee(s)`);
  }

  if (!dryRun && allRecords.length > 0) {
    console.log(`Historique ecrit dans ${outputPath}`);
  }

  console.log(`Backfill termine. ${totalRecords} prediction(s) traitee(s).`);
}

main().catch((error) => {
  console.error('Backfill impossible:', error);
  process.exit(1);
});
