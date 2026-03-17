import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
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
  return Math.min(parsed, 365);
}

function hasDryRunFlag() {
  return process.argv.includes('--dry-run') || process.env.LEARN_DRY_RUN === '1';
}

function getOutputPath() {
  const fromInline = process.argv.find((entry) => entry.startsWith('--output='))?.split('=')[1];
  const fromPairIndex = process.argv.findIndex((entry) => entry === '--output');
  const fromPair = fromPairIndex >= 0 ? process.argv[fromPairIndex + 1] : undefined;
  const fromEnv = process.env.LEARN_OUTPUT_FILE;

  return fromInline ?? fromPair ?? fromEnv ?? path.join(process.cwd(), 'scripts', 'output', 'prediction-history.json');
}

function formatDateStr(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}

function buildDateWindow(days: number) {
  const todayStr = getTodayDateStr();
  const today = new Date(
    Number(todayStr.slice(4, 8)),
    Number(todayStr.slice(2, 4)) - 1,
    Number(todayStr.slice(0, 2))
  );

  return Array.from({ length: days }, (_, index) => {
    const current = new Date(today);
    current.setDate(today.getDate() - index - 1);
    return formatDateStr(current);
  }).reverse();
}

async function collectDayHistory(dateStr: string) {
  const races = await getAllRaces(dateStr);
  const [flatWeights, trotWeights] = await Promise.all([
    getActiveModelWeightProfile('PLAT'),
    getActiveModelWeightProfile('TROT'),
  ]);

  const records: PredictionHistoryRecord[] = [];

  for (const race of races) {
    try {
      const [participants, definitiveRapports] = await Promise.all([
        getParticipants(dateStr, race.reunion, race.course),
        getDefinitiveRapports(dateStr, race.reunion, race.course).catch(() => ({})),
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
  const dates = buildDateWindow(days);
  const allRecords: PredictionHistoryRecord[] = [];

  console.log(`Backfill apprentissage sur ${dates.length} jour(s)${dryRun ? ' (dry-run)' : ''}...`);

  let totalRecords = 0;
  for (const dateStr of dates) {
    const records = await collectDayHistory(dateStr);
    totalRecords += records.length;
    allRecords.push(...records);

    if (!dryRun && hasAdmin && records.length > 0) {
      await storePredictionHistory(records);
    }

    console.log(`${dateStr}: ${records.length} prediction(s) capturee(s)`);
  }

  if (!dryRun) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(allRecords, null, 2), 'utf8');
    console.log(`Historique ecrit dans ${outputPath}`);
  }

  console.log(`Backfill termine. ${totalRecords} prediction(s) traitee(s).`);
}

main().catch((error) => {
  console.error('Backfill impossible:', error);
  process.exit(1);
});
