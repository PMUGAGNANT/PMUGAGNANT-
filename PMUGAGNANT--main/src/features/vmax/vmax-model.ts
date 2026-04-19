export type RaceRouteParams = {
  reunion: number;
  course: number;
};

export type ScoreTier = "gold" | "green" | "neutral";
export type StakeTone = "waiting" | "low" | "medium" | "high";
export type VmaxRaceStatus = "ready" | "soon" | "live" | "finished";
export type RaceVerdict = "JOUER" | "SURVEILLER" | "PASSER";

export type ParticipantTableRow = {
  numero: number;
  cheval: string;
  jockey: string;
  entraineur: string;
  cote: number | null;
  scoreIa: number | null;
  scoreV10?: number | null;
  scoreV10Role?: "CHOIX" | "PEPITE" | "CHASSEUR" | "PODIUM" | "OUTSIDER" | null;
  scoreV10Criteria?: {
    forme: number;
    value: number;
    jockeyHippodrome: number;
    distance: number;
  } | null;
  scoreV10BetType?: "GAGNANT" | "PLACE" | null;
  scoreV10Cote?: number | null;
  scoreV10JockeyRate?: number | null;
  scoreSource: "supabase" | "engine" | "fallback";
  musique: string | null;
  mise: number | null;
  topFacteur: string | null;
};

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

export type RaceVerdictInput = {
  numero: number;
  cheval: string;
  cote: number | null;
  score: number | null;
  bankroll?: number | null;
  kellyFraction?: number | null;
};

export type RaceVerdictSummary = {
  verdict: RaceVerdict;
  numero: number;
  cheval: string;
  cote: number | null;
  scorePercent: number;
  fairOdds: number | null;
  edge: number;
  stake: number;
};

const DEFAULT_KELLY_FRACTION = 0.25;
const MAX_KELLY_EDGE = 0.5;

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

const RUNNER_COLOR_CLASSES = [
  "bg-[#D4AF37] text-[#06100B]",
  "bg-[#00C851] text-[#06100B]",
  "bg-[#2F80ED] text-white",
  "bg-[#FF8A00] text-[#06100B]",
  "bg-[#D84C5F] text-white",
  "bg-[#9B5DE5] text-white",
  "bg-[#00B8A9] text-[#06100B]",
  "bg-[#F15BB5] text-white",
  "bg-[#6C8EAD] text-white",
  "bg-[#F9C74F] text-[#06100B]",
  "bg-[#43AA8B] text-[#06100B]",
  "bg-[#577590] text-white",
  "bg-[#F3722C] text-[#06100B]",
  "bg-[#90BE6D] text-[#06100B]",
  "bg-[#C77DFF] text-[#06100B]",
  "bg-[#4D96FF] text-white",
  "bg-[#EF476F] text-white",
  "bg-[#06D6A0] text-[#06100B]",
  "bg-[#FFD166] text-[#06100B]",
  "bg-[#A8DADC] text-[#06100B]",
] as const;

export function getRunnerNumberClass(numero: number | string | null | undefined) {
  const numeric = Number(numero);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "bg-slate-600 text-white";
  }

  return RUNNER_COLOR_CLASSES[(numeric - 1) % RUNNER_COLOR_CLASSES.length];
}

export function getScoreTier(score: number | null | undefined): ScoreTier {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return "neutral";
  }

  if (score >= 85) return "gold";
  if (score >= 70) return "green";
  return "neutral";
}

export function formatStakeLabel(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatStakeDetailLabel(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Calcul en attente";
  }

  return formatStakeLabel(value);
}

export function getScoreTierClass(score: number | null | undefined) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return "border-white/10 bg-white/10 text-slate-300";
  }

  if (score >= 85) return "border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37]";
  if (score >= 70) return "border-[#00C851]/40 bg-[#00C851]/15 text-[#00C851]";
  if (score >= 50) return "border-white/10 bg-white/10 text-slate-300";
  return "border-[#7F1D1D]/55 bg-[#7F1D1D]/30 text-[#FCA5A5]";
}

export function getScoreBadgeLabel(score: number | null | undefined) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return "N/C";
  }

  if (score >= 85) return "ELITE";
  if (score >= 70) return "BON";
  if (score >= 50) return "MOYEN";
  return "FAIBLE";
}

export function getStakeToneClass(value: number | null | undefined) {
  const tone = getStakeTone(value);
  if (tone === "low") return "bg-[#00C851]/15 text-[#00C851]";
  if (tone === "medium") return "bg-[#FF9F1C]/15 text-[#FF9F1C]";
  if (tone === "high") return "bg-[#FF4D5A]/15 text-[#FF4D5A]";
  return "bg-white/[0.08] text-slate-400";
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

export function formatStakeEuro(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return `${Math.max(0, Math.round(value))}€`;
}

export function getFairOddsFromScore(score: number | null | undefined) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }

  const probability = clamp((score / 100) * 0.52, 0.06, 0.68);
  return 1 / probability;
}

export function computeRunnerKellyStake(
  score: number | null | undefined,
  odds: number | null | undefined,
  bankroll?: number | null,
  kellyFraction = DEFAULT_KELLY_FRACTION
) {
  if (
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < 70 ||
    typeof odds !== "number" ||
    !Number.isFinite(odds) ||
    odds <= 1 ||
    typeof bankroll !== "number" ||
    !Number.isFinite(bankroll) ||
    bankroll <= 0
  ) {
    return null;
  }

  const pWin = clamp(score / 100, 0, 1);
  const edge = pWin * odds - 1;
  if (edge <= 0) {
    return null;
  }

  const cappedEdge = Math.min(edge, MAX_KELLY_EDGE);

  return Math.min(
    25,
    Math.max(1, Math.round((cappedEdge / (odds - 1)) * bankroll * kellyFraction))
  );
}

export function computeRaceVerdict(input: RaceVerdictInput): RaceVerdictSummary {
  const scorePercent =
    typeof input.score === "number" && Number.isFinite(input.score)
      ? clamp(input.score, 0, 100)
      : 0;
  const fairOdds = getFairOddsFromScore(scorePercent);
  const pmuOdds =
    typeof input.cote === "number" && Number.isFinite(input.cote) && input.cote > 1
      ? input.cote
      : null;
  const edge =
    fairOdds !== null && pmuOdds !== null ? 1 / fairOdds - 1 / pmuOdds : -1;
  const cappedEdge = edge > 0 ? Math.min(edge, MAX_KELLY_EDGE) : 0;
  const bankroll =
    typeof input.bankroll === "number" && Number.isFinite(input.bankroll) && input.bankroll > 0
      ? input.bankroll
      : null;
  const kellyFraction =
    typeof input.kellyFraction === "number" &&
    Number.isFinite(input.kellyFraction) &&
    input.kellyFraction > 0
      ? input.kellyFraction
      : DEFAULT_KELLY_FRACTION;
  const rawStake = bankroll !== null ? cappedEdge * bankroll * kellyFraction : 0;
  const stake = rawStake > 0 ? Math.min(25, Math.max(1, Math.round(rawStake))) : 0;
  const verdict: RaceVerdict =
    edge <= 0 ? "PASSER" : edge < 0.1 ? "SURVEILLER" : "JOUER";

  return {
    verdict,
    numero: input.numero,
    cheval: input.cheval,
    cote: pmuOdds,
    scorePercent: Math.round(scorePercent),
    fairOdds,
    edge: edge > 0 ? cappedEdge : edge,
    stake,
  };
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
      const cappedEdgePct = Math.min(edgePct, MAX_KELLY_EDGE * 100);

      return [{
        numero: row.numero,
        cheval: row.cheval,
        coteActuelle: row.cote,
        coteFair: fairOdds,
        edgePct: cappedEdgePct,
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

  if (typeof minutesUntilStart !== "number" || !Number.isFinite(minutesUntilStart)) {
    return "ready";
  }

  if (minutesUntilStart < -15) {
    return "finished";
  }

  if (minutesUntilStart <= 15) {
    return "live";
  }

  if (minutesUntilStart <= 30) {
    return "soon";
  }

  return "ready";
}
