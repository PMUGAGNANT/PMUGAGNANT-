import type { CourseRecordRow, PredictionRow, RunnerOutcomeRow } from "@/lib/types";

export type CoachAccessLevel = "premium" | "preview";

export interface CoachContextItem {
  id: string;
  date: string;
  race: string;
  hippodrome: string;
  courseName: string | null;
  meta: string;
  horseNumber: number;
  horseName: string;
  decision: string;
  betType: string | null;
  confidence: number;
  score: number;
  value: number | null;
  odds: number | null;
  stake: number | null;
  result: string;
  finishPosition: number | null;
  premiumLocked: boolean;
}

type RaceHint = {
  reunion: number | null;
  course: number | null;
  horseNumber: number | null;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractRaceHint(question: string): RaceHint {
  const normalized = normalizeText(question);
  const raceMatch = normalized.match(/\br\s*(\d{1,2})\s*c\s*(\d{1,2})\b/);
  const hashHorseMatch = normalized.match(/#\s*(\d{1,2})\b/);
  const horseMatch =
    hashHorseMatch ??
    normalized.match(/\b(?:cheval|numero|n|no)\s*(\d{1,2})\b/);

  return {
    reunion: raceMatch ? Number(raceMatch[1]) : null,
    course: raceMatch ? Number(raceMatch[2]) : null,
    horseNumber: horseMatch ? Number(horseMatch[1]) : null,
  };
}

function getPredictionScore(row: PredictionRow) {
  return row.score_blended ?? row.score_final_pari ?? row.score_cheval ?? 0;
}

function getOdds(row: PredictionRow) {
  return row.cote_depart ?? row.cote_matin ?? null;
}

function getCourseKey(row: Pick<PredictionRow, "date" | "reunion" | "course">) {
  return `${row.date}-${row.reunion}-${row.course}`;
}

function getRunnerKey(row: Pick<PredictionRow, "date" | "reunion" | "course" | "cheval_num">) {
  return `${getCourseKey(row)}-${row.cheval_num}`;
}

function getOutcomeResult(row: PredictionRow, outcome: RunnerOutcomeRow | undefined) {
  const finishPosition = outcome?.ordre_arrivee ?? null;
  if (finishPosition === 1 || row.resultat_gagnant === true) {
    return { result: "GAGNANT", finishPosition };
  }
  if (
    (finishPosition !== null && finishPosition <= 3) ||
    row.resultat_place === true
  ) {
    return { result: "PLACE", finishPosition };
  }
  if (finishPosition !== null || row.resultat_gagnant === false || row.resultat_place === false) {
    return { result: "PERDU", finishPosition };
  }
  return { result: "EN_ATTENTE", finishPosition };
}

function getRowRelevance(row: PredictionRow, normalizedQuestion: string, hint: RaceHint) {
  let relevance = 0;
  const horseName = normalizeText(row.cheval_nom);
  const tokens = normalizedQuestion
    .split(" ")
    .filter((token) => token.length >= 3 && !["cheval", "course", "pense", "quoi"].includes(token));

  if (hint.reunion !== null && row.reunion === hint.reunion) relevance += 24;
  if (hint.course !== null && row.course === hint.course) relevance += 24;
  if (hint.horseNumber !== null && row.cheval_num === hint.horseNumber) relevance += 36;
  if (horseName.length >= 4 && normalizedQuestion.includes(horseName)) relevance += 70;

  for (const token of tokens) {
    if (horseName.includes(token)) {
      relevance += token.length >= 5 ? 14 : 7;
    }
    if (normalizeText(row.hippodrome).includes(token)) {
      relevance += 4;
    }
  }

  if (row.decision === "VALIDE") relevance += 4;
  if (row.decision === "SURVEILLANCE") relevance += 2;
  relevance += Math.min(8, Math.max(0, getPredictionScore(row) / 12));

  return relevance;
}

function getDecisionPriority(row: PredictionRow) {
  if (row.decision === "VALIDE") return 3;
  if (row.decision === "SURVEILLANCE") return 2;
  return 1;
}

function toCoachItem(
  row: PredictionRow,
  course: CourseRecordRow | undefined,
  outcome: RunnerOutcomeRow | undefined,
  accessLevel: CoachAccessLevel
): CoachContextItem {
  const { result, finishPosition } = getOutcomeResult(row, outcome);
  const locked = accessLevel !== "premium";

  return {
    id: getRunnerKey(row),
    date: row.date,
    race: `R${row.reunion}C${row.course}`,
    hippodrome: row.hippodrome,
    courseName: course?.nom_course ?? null,
    meta: [
      course?.discipline,
      course?.distance ? `${course.distance}m` : null,
      course?.nombre_partants ? `${course.nombre_partants} partants` : null,
      course?.heure_depart ?? null,
    ]
      .filter(Boolean)
      .join(" - "),
    horseNumber: row.cheval_num,
    horseName: row.cheval_nom,
    decision: row.decision,
    betType: row.pari_conseille ?? null,
    confidence: round1(row.confiance ?? 0),
    score: round1(getPredictionScore(row)),
    value: row.value === null ? null : round2(row.value),
    odds: getOdds(row),
    stake: locked ? null : round2(row.mise_simulee ?? 0),
    result,
    finishPosition,
    premiumLocked: locked,
  };
}

export function getCoachDateWindow(todayIso: string, daysBack = 8) {
  const end = new Date(`${todayIso}T12:00:00.000Z`);
  if (Number.isNaN(end.getTime())) {
    return { startIso: todayIso, endIso: todayIso };
  }

  const start = new Date(end.getTime());
  start.setUTCDate(start.getUTCDate() - Math.max(1, daysBack));

  return {
    startIso: start.toISOString().slice(0, 10),
    endIso: todayIso,
  };
}

export function buildCoachContext(
  question: string,
  predictions: PredictionRow[],
  courses: CourseRecordRow[],
  outcomes: RunnerOutcomeRow[],
  accessLevel: CoachAccessLevel
) {
  const normalizedQuestion = normalizeText(question);
  const hint = extractRaceHint(question);
  const courseByKey = new Map(courses.map((course) => [getCourseKey(course), course] as const));
  const outcomeByRunner = new Map<string, RunnerOutcomeRow>(
    outcomes.map((outcome) => [
      `${outcome.date}-${outcome.reunion}-${outcome.course}-${outcome.cheval_num}`,
      outcome,
    ] as const)
  );

  const scored = predictions
    .filter((row) => !row.non_partant)
    .map((row) => ({
      row,
      relevance: getRowRelevance(row, normalizedQuestion, hint),
    }));
  const hasDirectMatch = scored.some((item) => item.relevance >= 30);
  const selected = scored
    .filter((item) => (hasDirectMatch ? item.relevance > 0 : item.row.decision !== "REJET"))
    .sort((left, right) => {
      if (hasDirectMatch && right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }
      const dateCompare = right.row.date.localeCompare(left.row.date);
      if (dateCompare !== 0) return dateCompare;
      const priorityCompare = getDecisionPriority(right.row) - getDecisionPriority(left.row);
      if (priorityCompare !== 0) return priorityCompare;
      return getPredictionScore(right.row) - getPredictionScore(left.row);
    })
    .slice(0, hasDirectMatch ? 8 : 10);

  return selected.map(({ row }) =>
    toCoachItem(
      row,
      courseByKey.get(getCourseKey(row)),
      outcomeByRunner.get(getRunnerKey(row)),
      accessLevel
    )
  );
}

export function buildCoachSystemPrompt(accessLevel: CoachAccessLevel) {
  const premiumRule =
    accessLevel === "premium"
      ? "L'utilisateur est Premium: tu peux mentionner scores, mises, cotes, value et resultats fournis."
      : "L'utilisateur est en apercu: ne revele pas les mises exactes; explique que le detail complet est Premium.";

  return [
    "Tu es Coach TurfEdge, assistant IA hippique pour analyser les chevaux PMU.",
    premiumRule,
    "Regles strictes:",
    "- Reponds uniquement avec les donnees du CONTEXTE_TURFEDGE.",
    "- Si une information manque, dis clairement: donnees insuffisantes.",
    "- Ne promets jamais un gain et ne donne jamais de certitude.",
    "- Reponds en francais simple, direct, utile, en 8 a 12 lignes maximum.",
    "- Termine avec une phrase courte de jeu responsable.",
  ].join("\n");
}

export function buildCoachUserPrompt(question: string, context: CoachContextItem[]) {
  return [
    `QUESTION_CLIENT: ${question}`,
    "CONTEXTE_TURFEDGE:",
    JSON.stringify(context, null, 2),
  ].join("\n\n");
}

function formatValue(value: number | null, suffix = "") {
  return value === null || !Number.isFinite(value) ? "--" : `${value}${suffix}`;
}

function formatConfidence(value: number) {
  const rounded = round1(value);
  return rounded <= 10 ? `${rounded}/10` : `${rounded}/100`;
}

function formatFinishPosition(value: number | null) {
  if (!value) return "";
  if (value === 1) return "1er";
  return `${value}e`;
}

function getDecisionLabel(item: CoachContextItem) {
  if (item.decision === "VALIDE") {
    return "feu vert TurfEdge";
  }
  if (item.decision === "SURVEILLANCE") {
    return "profil a surveiller";
  }
  return "profil a eviter pour le moment";
}

function getValueRead(item: CoachContextItem) {
  if (item.value === null || !Number.isFinite(item.value)) {
    return "Value: donnees insuffisantes.";
  }
  if (item.value >= 0.15) {
    return `Value: positive (${item.value}), le prix semble interessant.`;
  }
  if (item.value >= 0.05) {
    return `Value: legere (${item.value}), jouable mais sans forcer.`;
  }
  if (item.value >= 0) {
    return `Value: neutre (${item.value}), il faut rester prudent.`;
  }
  return `Value: negative (${item.value}), la cote n'offre pas beaucoup de marge.`;
}

function getStakeRead(item: CoachContextItem, accessLevel: CoachAccessLevel) {
  if (accessLevel !== "premium") {
    return "Mise conseillee: masquee en apercu, reservee Premium.";
  }

  if (item.stake === null || item.stake <= 0) {
    return "Mise conseillee: donnees insuffisantes.";
  }

  return `Mise conseillee: ${formatValue(item.stake, " EUR")}.`;
}

function getResultRead(item: CoachContextItem) {
  if (item.result === "EN_ATTENTE") {
    return "Resultat: pas encore consolide dans Supabase.";
  }

  const finish = formatFinishPosition(item.finishPosition);
  return `Resultat: ${item.result}${finish ? `, arrive ${finish}` : ""}.`;
}

function getRiskRead(item: CoachContextItem) {
  const confidence = item.confidence;
  const odds = item.odds ?? 0;
  const value = item.value ?? 0;

  if (item.decision === "REJET") {
    return "Lecture risque: trop faible pour en faire une selection principale.";
  }
  if (confidence >= 8 && value >= 0.1) {
    return "Lecture risque: tres bon signal, mais ca reste une course hippique.";
  }
  if (odds >= 10) {
    return "Lecture risque: cote haute, donc potentiel sympa mais variance elevee.";
  }
  if (value < 0) {
    return "Lecture risque: bon cheval possible, mauvais prix possible.";
  }

  return "Lecture risque: profil jouable, a calibrer avec la cote finale.";
}

function getSameRaceRivals(item: CoachContextItem, context: CoachContextItem[]) {
  return context
    .filter((candidate) => candidate.id !== item.id && candidate.race === item.race)
    .sort((left, right) => right.score - left.score)
    .slice(0, 2);
}

function getRivalRead(item: CoachContextItem, context: CoachContextItem[]) {
  const rivals = getSameRaceRivals(item, context);
  if (rivals.length === 0) {
    return "Comparaison course: donnees insuffisantes sur les rivaux directs.";
  }

  return `Rivaux a garder a l'oeil: ${rivals
    .map((rival) => `#${rival.horseNumber} ${rival.horseName} (${rival.score}/100)`)
    .join(", ")}.`;
}

function getFinalAdvice(item: CoachContextItem) {
  if (item.decision === "VALIDE" && (item.value ?? 0) >= 0.05) {
    return "Ma decision: selection prioritaire, surtout si la cote ne s'effondre pas.";
  }
  if (item.decision === "VALIDE") {
    return "Ma decision: bon profil, mais je surveille le prix avant de charger.";
  }
  if (item.decision === "SURVEILLANCE") {
    return "Ma decision: attente, seulement interessant si la cote devient meilleure.";
  }
  return "Ma decision: je passe tant qu'un signal nouveau ne change pas la lecture.";
}

export function buildFallbackCoachAnswer(
  question: string,
  context: CoachContextItem[],
  accessLevel: CoachAccessLevel
) {
  if (context.length === 0) {
    return [
      "Je n'ai pas assez de donnees TurfEdge pour repondre proprement a cette question.",
      "Donne-moi un format du type R1C4 #7 ou le nom exact du cheval, et je pourrai cibler l'analyse.",
      "Jeu responsable: un pronostic reste une aide a la decision, jamais une garantie.",
    ].join("\n");
  }

  const first = context[0];
  const oddsRead =
    first.odds === null ? "Cote observee: donnees insuffisantes." : `Cote observee: ${first.odds}.`;
  const metaRead = first.meta ? `${first.hippodrome} - ${first.meta}` : first.hippodrome;

  return [
    `Lecture TurfEdge sur ${first.race} #${first.horseNumber} ${first.horseName}: ${getDecisionLabel(first)}.`,
    `Score: ${first.score}/100. Confiance: ${formatConfidence(first.confidence)}. Pari conseille: ${first.betType ?? "donnees insuffisantes"}.`,
    `${oddsRead} ${getValueRead(first)}`,
    getStakeRead(first, accessLevel),
    getRiskRead(first),
    getResultRead(first),
    `Contexte: ${metaRead}.`,
    getRivalRead(first, context),
    getFinalAdvice(first),
    "Jeu responsable: ne mise que ce que tu peux perdre.",
  ].join("\n");
}
