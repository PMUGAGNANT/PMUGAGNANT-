export type RaceRouteParams = {
  reunion: number;
  course: number;
};

export type ScoreTier = "gold" | "green" | "neutral";
export type StakeTone = "waiting" | "low" | "medium" | "high";
export type VmaxRaceStatus = "ready" | "live" | "finished";

export type ValueBetInput = {
  numero: number;
  cheval: string;
  cote: number | null;
  scoreIa: number | null;
  raison?: string | null;
};

export type ValueBet = {
  numero: number;
  cheval: string;
  coteActuelle: number;
  coteFair: number;
  edgePct: number;
  explanation: string;
};

const RUNNER_COLORS = [
  "#D4AF37",
  "#00C851",
  "#2F80ED",
  "#FF8A00",
  "#D84C5F",
  "#9B5DE5",
  "#00B8A9",
  "#F15BB5",
  "#6C8EAD",
  "#F9C74F",
  "#43AA8B",
  "#577590",
  "#F3722C",
  "#90BE6D",
  "#C77DFF",
  "#4D96FF",
  "#EF476F",
  "#06D6A0",
  "#FFD166",
  "#A8DADC",
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function parseRaceAnalysisId(value: string): RaceRouteParams | null {
  const normalized = decodeURIComponent(value).trim().toLowerCase();
  const compact = normalized.match(/^r?(\d+)c(\d+)$/);
  const separated = normalized.match(/^r?(\d+)[-_:.](?:c)?(\d+)$/);
  const match = compact ?? separated;

  if (!match) {
    return null;
  }

  const reunion = Number(match[1]);
  const course = Number(match[2]);

  if (!Number.isInteger(reunion) || !Number.isInteger(course) || reunion <= 0 || course <= 0) {
    return null;
  }

  return { reunion, course };
}

export function formatRaceAnalysisId(reunion: number, course: number) {
  return `r${reunion}c${course}`;
}

export function getRunnerNumberColor(numero: number | string | null | undefined) {
  const numeric = Number(numero);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "#6B7280";
  }

  return RUNNER_COLORS[(numeric - 1) % RUNNER_COLORS.length];
}

export function getScoreTier(score: number | null | undefined): ScoreTier {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return "neutral";
  }

  if (score >= 90) return "gold";
  if (score >= 70) return "green";
  return "neutral";
}

export function formatStakeLabel(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Calcul en attente";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function getStakeTone(value: number | null | undefined): StakeTone {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "waiting";
  }

  if (value < 5) return "low";
  if (value <= 15) return "medium";
  return "high";
}

export function formatOdds(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(1);
}

export function getFairOddsFromScore(score: number | null | undefined) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }

  const probability = clamp((score / 100) * 0.52, 0.06, 0.68);
  return 1 / probability;
}

export function buildValueBets(rows: ValueBetInput[], limit = 4): ValueBet[] {
  return rows
    .flatMap((row) => {
      if (typeof row.cote !== "number" || !Number.isFinite(row.cote) || row.cote <= 1) {
        return [];
      }

      const fairOdds = getFairOddsFromScore(row.scoreIa);
      if (fairOdds === null) {
        return [];
      }

      const edgePct = ((row.cote - fairOdds) / fairOdds) * 100;
      if (edgePct <= 0) {
        return [];
      }

      return [{
        numero: row.numero,
        cheval: row.cheval,
        coteActuelle: row.cote,
        coteFair: fairOdds,
        edgePct,
        explanation:
          row.raison ??
          "L'IA estime une probabilite superieure a ce que le marche PMU implique.",
      }];
    })
    .sort((left, right) => right.edgePct - left.edgePct)
    .slice(0, limit);
}

export function getVmaxRaceStatus(stage: string | null | undefined, minutesUntilStart: number | null | undefined): VmaxRaceStatus {
  if (stage === "finished") {
    return "finished";
  }

  if (typeof minutesUntilStart === "number" && Number.isFinite(minutesUntilStart) && minutesUntilStart <= 0) {
    return "live";
  }

  return "ready";
}
