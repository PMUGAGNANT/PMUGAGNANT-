import type {
  BetRecommendationType,
  LearnedWeightKey,
  LearnedWeightMap,
  ModelWeightProfile,
  ModelWeightScope,
  MusicStats,
  RaceAnalysis,
  RaceSummary,
  Participant,
  PredictionHistoryRecord,
  RunnerFeatureSnapshot,
  RunnerScoreComponents,
  ScoredParticipant,
} from './types';
import { createSupabaseAdminClient } from './supabase';
import { BUNDLED_MODEL_WEIGHT_PROFILES } from './model-weights.generated';

export const MODEL_WEIGHT_KEYS: LearnedWeightKey[] = [
  'formScore',
  'serieBonus',
  'recentVictory',
  'formProgression',
  'eliteScore',
  'trainerScore',
  'winRateBonus',
  'ageBonus',
  'experienceBonus',
  'drawBonus',
  'weightBonus',
  'marketTrustBonus',
];

export const DEFAULT_LEARNED_WEIGHTS: LearnedWeightMap = {
  formScore: 1,
  serieBonus: 1,
  recentVictory: 1,
  formProgression: 1,
  eliteScore: 1,
  trainerScore: 1,
  winRateBonus: 1,
  ageBonus: 1,
  experienceBonus: 1,
  drawBonus: 1,
  weightBonus: 1,
  marketTrustBonus: 1,
};

type LearningResultStatus = PredictionHistoryRecord['resultStatus'];

function clampWeight(value: number) {
  return Math.max(0.55, Math.min(1.65, Math.round(value * 1000) / 1000));
}

export function toDateSortKey(dateStr: string) {
  if (!/^\d{8}$/.test(dateStr)) {
    return dateStr;
  }

  return `${dateStr.slice(4, 8)}${dateStr.slice(2, 4)}${dateStr.slice(0, 2)}`;
}

export function getMarketTrustRating(cote: number | null) {
  if (cote === null || !Number.isFinite(cote) || cote <= 0) {
    return 0.55;
  }

  if (cote <= 3.5) return 1;
  if (cote <= 6) return 0.92;
  if (cote <= 10) return 0.82;
  if (cote <= 15) return 0.7;
  if (cote <= 25) return 0.54;
  if (cote <= 40) return 0.36;
  if (cote <= 60) return 0.24;
  return 0.14;
}

export function getMarketTrustBonus(cote: number | null) {
  const trust = getMarketTrustRating(cote);

  if (trust >= 0.95) return 6;
  if (trust >= 0.85) return 4;
  if (trust >= 0.72) return 2.5;
  if (trust >= 0.55) return 1;
  if (trust >= 0.35) return -1;
  if (trust >= 0.2) return -3;
  return -5;
}

export function createDefaultWeightProfile(scope: ModelWeightScope = 'GLOBAL'): ModelWeightProfile {
  return {
    version: 'v3-default',
    scope,
    active: true,
    weights: { ...DEFAULT_LEARNED_WEIGHTS },
    metrics: {
      source: 'manual-default',
    },
    createdAt: new Date().toISOString(),
  };
}

export function normalizeLearnedWeights(
  rawWeights?: Partial<Record<LearnedWeightKey, number>> | null
): LearnedWeightMap {
  const normalized = { ...DEFAULT_LEARNED_WEIGHTS };

  if (!rawWeights) {
    return normalized;
  }

  for (const key of MODEL_WEIGHT_KEYS) {
    const value = rawWeights[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      normalized[key] = clampWeight(value);
    }
  }

  return normalized;
}

export function resolveWeightProfile(
  estPlat: boolean,
  activeProfile?: ModelWeightProfile | null
): LearnedWeightMap {
  if (!activeProfile) {
    return { ...DEFAULT_LEARNED_WEIGHTS };
  }

  if (activeProfile.scope === 'GLOBAL') {
    return normalizeLearnedWeights(activeProfile.weights);
  }

  if (estPlat && activeProfile.scope === 'PLAT') {
    return normalizeLearnedWeights(activeProfile.weights);
  }

  if (!estPlat && activeProfile.scope === 'TROT') {
    return normalizeLearnedWeights(activeProfile.weights);
  }

  return { ...DEFAULT_LEARNED_WEIGHTS };
}

export async function getActiveModelWeightProfile(scope: ModelWeightScope): Promise<ModelWeightProfile | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return BUNDLED_MODEL_WEIGHT_PROFILES[scope] ?? BUNDLED_MODEL_WEIGHT_PROFILES.GLOBAL;

  const { data, error } = await admin
    .from('model_weights')
    .select('version, scope, active, weights, metrics, created_at')
    .eq('active', true)
    .in('scope', [scope, 'GLOBAL'])
    .order('scope', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return BUNDLED_MODEL_WEIGHT_PROFILES[scope] ?? BUNDLED_MODEL_WEIGHT_PROFILES.GLOBAL;
  }

  return {
    version: data.version,
    scope: data.scope,
    active: data.active,
    weights: normalizeLearnedWeights(data.weights as Partial<Record<LearnedWeightKey, number>>),
    metrics: (data.metrics as Record<string, number | string | boolean | null> | null) ?? undefined,
    createdAt: data.created_at,
  };
}

export async function saveModelWeightProfile(profile: ModelWeightProfile) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante pour enregistrer le modele.');
  }

  await admin
    .from('model_weights')
    .update({ active: false })
    .eq('scope', profile.scope);

  const { error } = await admin.from('model_weights').insert({
    version: profile.version,
    scope: profile.scope,
    active: true,
    weights: normalizeLearnedWeights(profile.weights),
    metrics: profile.metrics ?? {},
  });

  if (error) {
    throw error;
  }
}

function normalizeCombinaisonForLookup(nums: number[]) {
  return [...nums].sort((left, right) => left - right).join('-');
}

export function getPredictionResultStatus(
  pariType: BetRecommendationType,
  ordreArrivee: Array<number | null>
): LearningResultStatus {
  if (ordreArrivee.some((position) => position === null)) {
    return 'INCONNU';
  }

  if (pariType === 'SIMPLE_GAGNANT') {
    const position = ordreArrivee[0];
    if (position === 1) return 'GAGNANT';
    if (position !== null && position <= 3) return 'PLACE';
    return 'PERDU';
  }

  if (pariType === 'COUPLE_PLACE') {
    return ordreArrivee.every((position) => position !== null && position <= 3)
      ? 'GAGNANT'
      : 'PERDU';
  }

  if (pariType === 'COUPLE_GAGNANT') {
    return ordreArrivee.every((position) => position !== null && position <= 2)
      ? 'GAGNANT'
      : 'PERDU';
  }

  return 'INCONNU';
}

export function getPredictionRapportFinalForOneEuro(
  pariType: BetRecommendationType,
  resultat: LearningResultStatus,
  numeros: number[],
  definitiveRapports: Record<string, Record<string, number>>
) {
  if (pariType === 'SIMPLE_GAGNANT') {
    const simpleKey = String(numeros[0]);
    if (resultat === 'GAGNANT') {
      return definitiveRapports.SIMPLE_GAGNANT?.[simpleKey] ?? null;
    }
    if (resultat === 'PLACE') {
      return definitiveRapports.SIMPLE_PLACE?.[simpleKey] ?? null;
    }
    return null;
  }

  const combinaisonKey = normalizeCombinaisonForLookup(numeros);
  if (pariType === 'COUPLE_PLACE' && resultat === 'GAGNANT') {
    return definitiveRapports.COUPLE_PLACE?.[combinaisonKey] ?? null;
  }
  if (pariType === 'COUPLE_GAGNANT' && resultat === 'GAGNANT') {
    return definitiveRapports.COUPLE_GAGNANT?.[combinaisonKey] ?? null;
  }

  return null;
}

function pickFeatureSnapshot(top5: ScoredParticipant[], horseNum: number) {
  return top5.find((runner) => runner.numPmu === horseNum)?.featureSnapshot ?? null;
}

export function buildPredictionHistoryRecords(
  dateStr: string,
  race: RaceSummary,
  participants: Participant[],
  analysis: RaceAnalysis,
  definitiveRapports: Record<string, Record<string, number>>
): PredictionHistoryRecord[] {
  const records: Array<PredictionHistoryRecord | null> = analysis.parisRecommandes
    .map((pari, index) => {
      const chevaux = pari.chevaux.map((cheval) => {
        const participant = participants.find((entry) => entry.numPmu === cheval.numPmu);
        return {
          numPmu: cheval.numPmu,
          nom: cheval.nom,
          ordreArrivee: participant?.ordreArrivee ?? null,
          cotePmu: participant?.cote ?? null,
        };
      });

      const resultat = getPredictionResultStatus(
        pari.type,
        chevaux.map((horse) => horse.ordreArrivee)
      );
      const gainForOneEuro = getPredictionRapportFinalForOneEuro(
        pari.type,
        resultat,
        chevaux.map((horse) => horse.numPmu),
        definitiveRapports
      );

      const featureSnapshot =
        pickFeatureSnapshot(analysis.top5, chevaux[0]?.numPmu ?? 0) ??
        analysis.favori?.featureSnapshot;

      if (!featureSnapshot) {
        return null;
      }

      return {
        dateStr,
        dateSortKey: toDateSortKey(dateStr),
        reunion: race.reunion,
        course: race.course,
        hippodrome: race.hippodrome,
        discipline: race.discipline,
        pariType: pari.type,
        recommendationRank: index + 1,
        recommendedHorse1Num: chevaux[0]?.numPmu ?? 0,
        recommendedHorse1Nom: chevaux[0]?.nom ?? '',
        recommendedHorse2Num: chevaux[1]?.numPmu ?? null,
        recommendedHorse2Nom: chevaux[1]?.nom ?? null,
        confiance: analysis.scoreConfiance?.score ?? 0,
        surete: pari.surete,
        coteEstimee: pari.coteEstimee,
        cotePmu: chevaux[0]?.cotePmu ?? null,
        resultStatus: resultat,
        gainForOneEuro,
        featureSnapshot,
      } satisfies PredictionHistoryRecord;
    });

  return records.filter((record): record is PredictionHistoryRecord => record !== null);
}

export function extractRunnerFeatureSnapshot(
  participant: Participant,
  musicStats: MusicStats | null,
  components: RunnerScoreComponents,
  estPlat: boolean
): RunnerFeatureSnapshot {
  return {
    numPmu: participant.numPmu,
    nom: participant.nom,
    cote: participant.cote,
    placeCorde: participant.placeCorde,
    poids: participant.poids,
    age: participant.age,
    nombreCourses: participant.nombreCourses,
    nombreVictoires: participant.nombreVictoires,
    nombrePlaces: participant.nombrePlaces,
    gainCarriere: participant.gainCarriere,
    nombreSuiveurs: participant.nombreSuiveurs,
    musique: participant.musique,
    fiabilite: musicStats?.fiabilite ?? 0,
    ratioForme: musicStats?.ratioForme ?? 0,
    averagePosition: musicStats?.averagePosition ?? 99,
    serie: musicStats?.serie ?? 0,
    trend: musicStats?.trend ?? 0,
    estPlat,
    scoreComponents: components,
  };
}

export async function storePredictionHistory(records: PredictionHistoryRecord[]) {
  if (records.length === 0) return;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante pour enregistrer l historique.');
  }

  const payload = records.map((record) => ({
    date_str: record.dateStr,
    date_sort_key: record.dateSortKey ?? toDateSortKey(record.dateStr),
    reunion: record.reunion,
    course: record.course,
    hippodrome: record.hippodrome,
    discipline: record.discipline,
    pari_type: record.pariType,
    recommendation_rank: record.recommendationRank,
    recommended_horse_1_num: record.recommendedHorse1Num,
    recommended_horse_1_nom: record.recommendedHorse1Nom,
    recommended_horse_2_num: record.recommendedHorse2Num ?? null,
    recommended_horse_2_nom: record.recommendedHorse2Nom ?? null,
    confiance: record.confiance,
    surete: record.surete,
    cote_estimee: record.coteEstimee,
    cote_pmu: record.cotePmu,
    result_status: record.resultStatus,
    gain_for_one_euro: record.gainForOneEuro,
    feature_snapshot: record.featureSnapshot,
  }));

  const { error } = await admin
    .from('prediction_history')
    .upsert(payload, {
      onConflict:
        'date_str,reunion,course,pari_type,recommendation_rank,recommended_horse_1_num,recommended_horse_2_num',
    });

  if (error) {
    throw error;
  }
}
