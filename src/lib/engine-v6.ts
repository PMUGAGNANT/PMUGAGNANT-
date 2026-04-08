import type { AlgoParameters, RaceSummary, SegmentKey } from "@/lib/types";

export const ENGINE_V6_VERSION = "v6-phase0";

function simpleHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function getEngineConfigVersion(parameters: AlgoParameters) {
  return `cfg-${simpleHash(JSON.stringify(parameters))}`;
}

export function getRaceSegmentKey(race: RaceSummary): SegmentKey {
  const discipline = (race.discipline ?? "").toUpperCase();

  if (race.estQuinte) {
    return "QUINTE";
  }

  if (discipline.includes("MONTE")) {
    return "TROT_MONTE";
  }

  if (race.estTrot || discipline.includes("TROT")) {
    return "TROT_ATTELE";
  }

  if (
    discipline.includes("OBSTACLE") ||
    discipline.includes("HAIE") ||
    discipline.includes("STEEPLE") ||
    discipline.includes("CROSS")
  ) {
    return "OBSTACLE";
  }

  if (race.estPlat || discipline.includes("PLAT")) {
    if (race.distance > 0 && race.distance < 1600) {
      return "PLAT_SPRINT";
    }
    if (race.distance > 0 && race.distance <= 2100) {
      return "PLAT_MILE";
    }
    return "PLAT_LONG";
  }

  if (race.distance > 0 && race.distance < 1600) {
    return "PLAT_SPRINT";
  }
  if (race.distance > 0 && race.distance <= 2100) {
    return "PLAT_MILE";
  }
  return "PLAT_LONG";
}
