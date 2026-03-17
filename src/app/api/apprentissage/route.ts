import { NextResponse } from "next/server";

import {
  DEFAULT_LEARNED_WEIGHTS,
  getActiveModelWeightProfile,
  MODEL_WEIGHT_KEYS,
} from "@/lib/learning";
import { hasSupabaseAdminConfig } from "@/lib/supabase";
import type { LearnedWeightKey, ModelWeightProfile, ModelWeightScope } from "@/lib/types";

export const dynamic = "force-dynamic";

const SIGNAL_META: Record<
  LearnedWeightKey,
  { label: string; description: string }
> = {
  formScore: {
    label: "Forme recente",
    description: "Les dernieres performances du cheval.",
  },
  serieBonus: {
    label: "Serie",
    description: "Les podiums consecutifs et la dynamique recente.",
  },
  recentVictory: {
    label: "Victoire recente",
    description: "Le fait d'avoir gagne tres recemment.",
  },
  formProgression: {
    label: "Progression",
    description: "Le cheval s'ameliore ou se degrade.",
  },
  eliteScore: {
    label: "Jockey / driver",
    description: "Poids accorde au niveau du pilote.",
  },
  trainerScore: {
    label: "Entraineur",
    description: "Qualite et regularite de l'entraineur.",
  },
  winRateBonus: {
    label: "Ratio victoire / place",
    description: "Capacite a finir devant sur la duree.",
  },
  ageBonus: {
    label: "Age",
    description: "Fenetre d'age ideale selon la discipline.",
  },
  experienceBonus: {
    label: "Experience",
    description: "Volume de courses et solidite de parcours.",
  },
  drawBonus: {
    label: "Stalle / corde",
    description: "Avantage de position au depart.",
  },
  weightBonus: {
    label: "Poids",
    description: "Charge portee par le cheval.",
  },
  marketTrustBonus: {
    label: "Confiance marche",
    description: "Lecture du marche PMU et du niveau de cote.",
  },
};

function formatScopeLabel(scope: ModelWeightScope) {
  if (scope === "PLAT") return "Plat";
  if (scope === "TROT") return "Trot";
  return "Global";
}

function normalizeMetricNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getSignalRows(profile: ModelWeightProfile) {
  return MODEL_WEIGHT_KEYS.map((key) => {
    const value = profile.weights[key] ?? DEFAULT_LEARNED_WEIGHTS[key];
    const delta = value - 1;
    let impact: "boost" | "neutral" | "trim" = "neutral";

    if (value >= 1.03) impact = "boost";
    else if (value <= 0.97) impact = "trim";

    return {
      key,
      label: SIGNAL_META[key].label,
      description: SIGNAL_META[key].description,
      value,
      delta,
      impact,
    };
  });
}

function summarizeProfile(profile: ModelWeightProfile) {
  const signals = getSignalRows(profile);
  const strongestSignals = [...signals]
    .sort((left, right) => right.value - left.value)
    .slice(0, 4);
  const weakestSignals = [...signals]
    .sort((left, right) => left.value - right.value)
    .slice(0, 4);

  const metrics = profile.metrics ?? {};
  const samples = normalizeMetricNumber(metrics.samples);
  const successRate = normalizeMetricNumber(metrics.success_rate);
  const successes = normalizeMetricNumber(metrics.successes);
  const failures = normalizeMetricNumber(metrics.failures);

  return {
    scope: profile.scope,
    label: formatScopeLabel(profile.scope),
    version: profile.version,
    createdAt: profile.createdAt ?? null,
    samples,
    successRate,
    successes,
    failures,
    strongestSignals,
    weakestSignals,
    signals,
  };
}

function buildHealthMessage(globalProfile: ReturnType<typeof summarizeProfile>) {
  if (globalProfile.samples < 1000) {
    return "Modele encore jeune: l'historique est trop court pour tirer des conclusions fortes.";
  }

  if (globalProfile.successRate >= 32) {
    return "Le modele est dans une bonne zone de fiabilite et les signaux appris sont coherents.";
  }

  if (globalProfile.successRate >= 24) {
    return "Le modele a une base d'apprentissage solide, mais il doit encore mieux filtrer les couples et les outsiders.";
  }

  return "Le modele apprend deja de l'historique, mais il reste fragile: il faut encore mieux separer les courses lisibles des courses pieges.";
}

export async function GET() {
  try {
    const [globalProfile, platProfile, trotProfile] = await Promise.all([
      getActiveModelWeightProfile("GLOBAL"),
      getActiveModelWeightProfile("PLAT"),
      getActiveModelWeightProfile("TROT"),
    ]);

    const profiles = [globalProfile, platProfile, trotProfile]
      .filter((profile): profile is ModelWeightProfile => Boolean(profile))
      .map(summarizeProfile);

    const globalSummary = profiles.find((profile) => profile.scope === "GLOBAL") ?? profiles[0];

    if (!globalSummary) {
      return NextResponse.json({
        success: false,
        message: "Aucun modele d'apprentissage disponible.",
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        source: hasSupabaseAdminConfig() ? "supabase" : "modele-emarque",
        samples: globalSummary.samples,
        successRate: globalSummary.successRate,
        lastTrainingAt: globalSummary.createdAt,
        healthMessage: buildHealthMessage(globalSummary),
      },
      profiles,
    });
  } catch {
    return NextResponse.json({
      success: false,
      message: "Impossible de charger l'apprentissage IA.",
    });
  }
}
