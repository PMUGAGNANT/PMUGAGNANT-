import { DEFAULT_ALGO_PARAMETERS } from "@/lib/config";
import type {
  AlgoParameters,
  Lisibilite,
  RaceSummary,
  ScoredParticipant,
} from "@/lib/types";
import { clamp, normalizeKey } from "@/lib/engine/shared";

function getTerrainReadabilitySignal(race: RaceSummary) {
  const terrain = normalizeKey(race.terrain);
  if (!terrain) return 0;

  if (
    terrain.includes("bon") ||
    terrain.includes("good") ||
    terrain.includes("firm")
  ) {
    return 2;
  }
  if (terrain.includes("souple") || terrain.includes("soft")) {
    return -1;
  }
  if (
    terrain.includes("lourd") ||
    terrain.includes("heavy") ||
    terrain.includes("collant")
  ) {
    return -3;
  }

  return 0;
}

function getWeatherReadabilitySignal(race: RaceSummary) {
  const meteo = normalizeKey(race.meteo);
  if (!meteo) return 0;

  if (
    meteo.includes("soleil") ||
    meteo.includes("ensoleille") ||
    meteo.includes("sun")
  ) {
    return 1;
  }
  if (meteo.includes("pluie") || meteo.includes("rain")) {
    return -2;
  }
  if (
    meteo.includes("orage") ||
    meteo.includes("storm") ||
    meteo.includes("vent fort")
  ) {
    return -4;
  }

  return 0;
}

export function determineRaceReadabilityScore(
  race: RaceSummary,
  ranked: ScoredParticipant[]
) {
  let score = 58;

  if (race.nombrePartants <= 10) score += 10;
  else if (race.nombrePartants <= 14) score += 5;
  else if (race.nombrePartants >= 18) score -= 10;

  if (race.estQuinte) score -= 5;
  if (race.discipline.includes("OBSTACLE")) score -= 6;

  const top3 = ranked.slice(0, 3);
  if (top3.length > 0) {
    const gap12 =
      top3.length > 1
        ? top3[0].prediction.scoreCheval - top3[1].prediction.scoreCheval
        : top3[0].prediction.scoreCheval;
    const gap13 =
      top3.length > 2
        ? top3[0].prediction.scoreCheval - top3[2].prediction.scoreCheval
        : gap12;

    if (gap12 >= 8) score += 12;
    else if (gap12 >= 5) score += 8;
    else if (gap12 <= 2) score -= 10;

    if (gap13 <= 5) score -= 8;

    const averageRegularity =
      top3.reduce((sum, runner) => sum + runner.signaux.regularite, 0) /
      top3.length;
    score += clamp(Math.round(averageRegularity / 2), -6, 8);
  }

  const fragileTop3 = top3.filter((runner) => runner.signaux.risque >= 9).length;
  score -= fragileTop3 * 4;
  score += getTerrainReadabilitySignal(race);
  score += getWeatherReadabilitySignal(race);

  return clamp(score, 0, 100);
}

export function determinerLisibilite(
  race: RaceSummary,
  ranked: ScoredParticipant[],
  parameters: AlgoParameters = DEFAULT_ALGO_PARAMETERS
): Lisibilite {
  const score = determineRaceReadabilityScore(race, ranked);
  if (score >= parameters.lisibilite.thresholds.readableMin) return "LISIBLE";
  if (score >= parameters.lisibilite.thresholds.complexMin) return "COMPLEXE";
  return "LOTERIE";
}
