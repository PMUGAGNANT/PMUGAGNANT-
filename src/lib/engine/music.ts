import type { MusicStats } from "@/lib/types";
import { round2 } from "@/lib/engine/shared";

export function countEncodedRuns(music: string) {
  return Array.from(music ?? "").filter((char) => /\d|D|a/.test(char)).length;
}

export function parseMusic(music: string): MusicStats {
  if (!music || music.trim() === "") {
    return {
      recentPositions: [],
      nbVictoires: 0,
      nbPodiums: 0,
      nbDQ: 0,
      nbAbandons: 0,
      fiabilite: 0,
      averagePosition: 99,
      serie: 0,
      trend: 0,
      ratioForme: 0,
    };
  }

  const raw = music.slice(-12);
  const positions: number[] = [];
  let nbDQ = 0;
  let nbAbandons = 0;
  let totalRaces = 0;

  for (const character of raw) {
    if (character >= "1" && character <= "9") {
      positions.push(Number.parseInt(character, 10));
      totalRaces += 1;
    } else if (character === "0") {
      positions.push(10);
      totalRaces += 1;
    } else if (character === "D") {
      nbDQ += 1;
      totalRaces += 1;
    } else if (character === "a") {
      nbAbandons += 1;
      totalRaces += 1;
    }
  }

  const recentPositions = positions.slice(-5);
  const nbVictoires = positions.filter((position) => position === 1).length;
  const nbPodiums = positions.filter((position) => position <= 3).length;
  const fiabilite =
    totalRaces > 0 ? (totalRaces - nbDQ - nbAbandons) / totalRaces : 0;
  const averagePosition =
    recentPositions.length > 0
      ? recentPositions.reduce((sum, position) => sum + position, 0) /
        recentPositions.length
      : 99;

  let serie = 0;
  for (let index = recentPositions.length - 1; index >= 0; index -= 1) {
    if (recentPositions[index] <= 3) {
      serie += 1;
    } else {
      break;
    }
  }

  let trend = 0;
  if (recentPositions.length >= 5) {
    const oldAverage = (recentPositions[0] + recentPositions[1]) / 2;
    const newAverage =
      (recentPositions[2] + recentPositions[3] + recentPositions[4]) / 3;
    trend = oldAverage - newAverage;
  } else if (recentPositions.length >= 3) {
    const middle = Math.floor(recentPositions.length / 2);
    const older = recentPositions.slice(0, middle);
    const newer = recentPositions.slice(middle);
    const olderAverage =
      older.reduce((sum, position) => sum + position, 0) / older.length;
    const newerAverage =
      newer.reduce((sum, position) => sum + position, 0) / newer.length;
    trend = olderAverage - newerAverage;
  }

  let ratioForme = 0;
  if (recentPositions.length > 0) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (let index = 0; index < recentPositions.length; index += 1) {
      const weight = index + 1;
      const position = recentPositions[index];
      let positionScore = 0.2;

      if (position === 1) positionScore = 1;
      else if (position === 2) positionScore = 0.8;
      else if (position === 3) positionScore = 0.6;
      else if (position === 4) positionScore = 0.4;

      weightedSum += positionScore * weight;
      totalWeight += weight;
    }

    ratioForme = totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  return {
    recentPositions,
    nbVictoires,
    nbPodiums,
    nbDQ,
    nbAbandons,
    fiabilite,
    averagePosition: round2(averagePosition),
    serie,
    trend: round2(trend),
    ratioForme: round2(ratioForme),
  };
}
