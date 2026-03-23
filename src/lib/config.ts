import type { AlgoParameters } from "@/lib/types";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const DEFAULT_ALGO_PARAMETERS: AlgoParameters = {
  validation: {
    confianceMin: 6,
    qualiteMin: 70,
    lisibilitesAcceptees: ["LISIBLE", "COMPLEXE"],
  },
  lisibilite: {
    coefficients: {
      LISIBLE: 1,
      COMPLEXE: 0.6,
      LOTERIE: 0,
    },
    valueCoefficients: {
      LISIBLE: 1,
      COMPLEXE: 0.5,
      LOTERIE: 0,
    },
    thresholds: {
      readableMin: 66,
      complexMin: 38,
    },
  },
  value: {
    maxCap: 5,
    confidenceMin: 6,
  },
  outsiders: {
    coteMin: 8,
    variationMinPct: -15,
    miseReductionFactor: 0.5,
    maxPerReunion: 1,
  },
  preRace: {
    strongDropPct: -20,
    negativeRisePct: 30,
    strongBonus: 1,
    riseMalus: 1.5,
    retractDecisionBelowConfidence: 6,
  },
  fautifs: {
    warningRate: 0.3,
    rejectRate: 0.5,
    warningMalus: 1.5,
  },
};

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T extends JsonRecord>(base: T, override: JsonRecord): T {
  const next: JsonRecord = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const current = next[key];
    if (isJsonRecord(current) && isJsonRecord(value)) {
      next[key] = deepMerge(current, value);
    } else {
      next[key] = value;
    }
  }

  return next as T;
}

export async function loadAlgoParameters(): Promise<AlgoParameters> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return DEFAULT_ALGO_PARAMETERS;
  }

  const { data, error } = await admin.from("parametres").select("key, value_json");
  if (error || !data || data.length === 0) {
    return DEFAULT_ALGO_PARAMETERS;
  }

  const overrides = data.reduce<JsonRecord>((acc, row) => {
    if (row.key && row.value_json) {
      acc[row.key] = row.value_json;
    }
    return acc;
  }, {});

  const nestedOverride: JsonRecord = {
    validation: overrides.validation ?? {},
    lisibilite: overrides.lisibilite ?? {},
    value: overrides.value ?? {},
    outsiders: overrides.outsiders ?? {},
    preRace: overrides.preRace ?? {},
    fautifs: overrides.fautifs ?? {},
  };

  return deepMerge(
    DEFAULT_ALGO_PARAMETERS as unknown as JsonRecord,
    nestedOverride
  ) as unknown as AlgoParameters;
}
