import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  DEFAULT_LEARNED_WEIGHTS,
  MODEL_WEIGHT_KEYS,
  normalizeLearnedWeights,
  saveModelWeightProfile,
  toDateSortKey,
} from '../src/lib/learning';
import { createSupabaseAdminClient } from '../src/lib/supabase';
import type {
  LearnedWeightKey,
  LearnedWeightMap,
  ModelWeightProfile,
  ModelWeightScope,
  PredictionHistoryRecord,
  RunnerFeatureSnapshot,
} from '../src/lib/types';

type RawPredictionHistoryRow = {
  discipline: string;
  result_status: PredictionHistoryRecord['resultStatus'];
  feature_snapshot: RunnerFeatureSnapshot;
  date_sort_key: string;
};

function parseDaysArg() {
  const fromInline = process.argv.find((entry) => entry.startsWith('--days='))?.split('=')[1];
  const fromPairIndex = process.argv.findIndex((entry) => entry === '--days');
  const fromPair = fromPairIndex >= 0 ? process.argv[fromPairIndex + 1] : undefined;
  const fromEnv = process.env.LEARN_DAYS;
  const parsed = Number(fromInline ?? fromPair ?? fromEnv ?? 365);
  if (!Number.isFinite(parsed) || parsed <= 0) return 365;
  return Math.min(parsed, 1095);
}

function getDateFloor(days: number) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return toDateSortKey(`${day}${month}${year}`);
}

function getInputPath() {
  const fromInline = process.argv.find((entry) => entry.startsWith('--input='))?.split('=')[1];
  const fromPairIndex = process.argv.findIndex((entry) => entry === '--input');
  const fromPair = fromPairIndex >= 0 ? process.argv[fromPairIndex + 1] : undefined;
  const fromEnv = process.env.LEARN_INPUT_FILE;

  return fromInline ?? fromPair ?? fromEnv ?? path.join(process.cwd(), 'scripts', 'output', 'prediction-history.json');
}

function getOutputPath() {
  const fromInline = process.argv.find((entry) => entry.startsWith('--output='))?.split('=')[1];
  const fromPairIndex = process.argv.findIndex((entry) => entry === '--output');
  const fromPair = fromPairIndex >= 0 ? process.argv[fromPairIndex + 1] : undefined;
  const fromEnv = process.env.LEARN_MODEL_FILE;

  return fromInline ?? fromPair ?? fromEnv ?? path.join(process.cwd(), 'src', 'lib', 'model-weights.generated.ts');
}

function isSuccess(resultStatus: PredictionHistoryRecord['resultStatus']) {
  return resultStatus === 'GAGNANT' || resultStatus === 'PLACE';
}

function getScopeFilter(row: RawPredictionHistoryRow, scope: ModelWeightScope) {
  if (scope === 'GLOBAL') return true;
  if (scope === 'PLAT') return row.feature_snapshot?.estPlat === true;
  return row.feature_snapshot?.estPlat === false;
}

function normalizeComponentValue(key: LearnedWeightKey, snapshot: RunnerFeatureSnapshot) {
  const value = snapshot.scoreComponents?.[key] ?? 0;

  if (key === 'drawBonus' || key === 'weightBonus' || key === 'marketTrustBonus') {
    return Math.max(-6, Math.min(12, value));
  }

  return Math.max(0, Math.min(18, value));
}

function computeWeightProfile(
  rows: RawPredictionHistoryRow[],
  scope: ModelWeightScope
): ModelWeightProfile | null {
  const scopedRows = rows.filter((row) => getScopeFilter(row, scope));
  if (scopedRows.length < 25) {
    return null;
  }

  const successes = scopedRows.filter((row) => isSuccess(row.result_status));
  const failures = scopedRows.filter((row) => !isSuccess(row.result_status));

  if (successes.length === 0 || failures.length === 0) {
    return null;
  }

  const weights: Partial<LearnedWeightMap> = {};

  for (const key of MODEL_WEIGHT_KEYS) {
    const successAvg =
      successes.reduce(
        (sum, row) => sum + normalizeComponentValue(key, row.feature_snapshot),
        0
      ) / successes.length;
    const failureAvg =
      failures.reduce(
        (sum, row) => sum + normalizeComponentValue(key, row.feature_snapshot),
        0
      ) / failures.length;

    const delta = successAvg - failureAvg;
    const amplitude = key === 'serieBonus' || key === 'recentVictory' ? 10 : 6;
    const learnedWeight =
      DEFAULT_LEARNED_WEIGHTS[key] + Math.max(-0.32, Math.min(0.32, delta / amplitude));

    weights[key] = learnedWeight;
  }

  return {
    version: `learned-${scope.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`,
    scope,
    active: true,
    weights: normalizeLearnedWeights(weights),
    metrics: {
      samples: scopedRows.length,
      success_rate: Math.round((successes.length / scopedRows.length) * 1000) / 10,
      successes: successes.length,
      failures: failures.length,
    },
    createdAt: new Date().toISOString(),
  };
}

async function main() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.log('SUPABASE_SERVICE_ROLE_KEY absente: recalibrage local seulement.');
  }

  const days = parseDaysArg();
  const minDate = getDateFloor(days);
  const inputPath = getInputPath();
  const outputPath = getOutputPath();

  let rows: RawPredictionHistoryRow[] = [];
  if (admin) {
    const { data, error } = await admin
      .from('prediction_history')
      .select('discipline, result_status, feature_snapshot, date_sort_key')
      .gte('date_sort_key', minDate);

    if (error) {
      throw error;
    }

    rows = (data ?? []) as RawPredictionHistoryRow[];
  }

  if (rows.length === 0) {
    const fileData = await readFile(inputPath, 'utf8');
    const parsed = JSON.parse(fileData) as Array<{
      discipline: string;
      resultStatus: PredictionHistoryRecord['resultStatus'];
      featureSnapshot: RunnerFeatureSnapshot;
      dateStr: string;
    }>;

    rows = parsed
      .filter((row) => toDateSortKey(row.dateStr) >= minDate)
      .map((row) => ({
        discipline: row.discipline,
        result_status: row.resultStatus,
        feature_snapshot: row.featureSnapshot,
        date_sort_key: toDateSortKey(row.dateStr),
      }));
  }

  const profiles = (['GLOBAL', 'PLAT', 'TROT'] as ModelWeightScope[])
    .map((scope) => computeWeightProfile(rows, scope))
    .filter((profile): profile is ModelWeightProfile => Boolean(profile));

  if (profiles.length === 0) {
    console.log('Pas assez de donnees pour recalibrer le modele.');
    return;
  }

  const bundledPayload = profiles.reduce<Record<ModelWeightScope, ModelWeightProfile>>(
    (acc, profile) => {
      acc[profile.scope] = profile;
      return acc;
    },
    {
      GLOBAL: {
        version: 'v3-default',
        scope: 'GLOBAL',
        active: true,
        weights: { ...DEFAULT_LEARNED_WEIGHTS },
        metrics: { source: 'fallback-default' },
      },
      PLAT: {
        version: 'v3-default',
        scope: 'PLAT',
        active: true,
        weights: { ...DEFAULT_LEARNED_WEIGHTS },
        metrics: { source: 'fallback-default' },
      },
      TROT: {
        version: 'v3-default',
        scope: 'TROT',
        active: true,
        weights: { ...DEFAULT_LEARNED_WEIGHTS },
        metrics: { source: 'fallback-default' },
      },
    }
  );

  const fileContents = `import type { ModelWeightProfile, ModelWeightScope } from './types';\n\nexport const BUNDLED_MODEL_WEIGHT_PROFILES: Record<ModelWeightScope, ModelWeightProfile> = ${JSON.stringify(
    bundledPayload,
    null,
    2
  )} as const;\n`;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, fileContents, 'utf8');
  console.log(`Profils embarques ecrits dans ${outputPath}`);

  for (const profile of profiles) {
    if (admin) {
      await saveModelWeightProfile(profile);
      console.log(
        `Profil ${profile.scope} mis a jour (${profile.metrics?.samples ?? 0} echantillons).`
      );
    } else {
      console.log(
        `Profil ${profile.scope} recalcule localement (${profile.metrics?.samples ?? 0} echantillons).`
      );
    }
  }
}

main().catch((error) => {
  console.error('Recalibrage impossible:', error);
  process.exit(1);
});
