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

export type CoachIntent =
  | "horse"
  | "best"
  | "value"
  | "result"
  | "compare"
  | "avoid"
  | "why"
  | "help"
  | "premium"
  | "greeting"
  | "general";

export interface CoachInsight {
  intent: CoachIntent;
  title: string;
  subtitle: string;
  verdict: string;
  tone: "green" | "orange" | "red" | "neutral";
  action: string;
  metrics: Array<{
    label: string;
    value: string;
    tone?: "green" | "orange" | "red" | "neutral";
  }>;
  facts: string[];
  rivals: Array<{
    label: string;
    score: string;
  }>;
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

function hasTurfSignal(question: string) {
  const normalized = normalizeText(question);
  const hint = extractRaceHint(question);

  return (
    hint.reunion !== null ||
    hint.course !== null ||
    hint.horseNumber !== null ||
    /\b(cheval|course|partant|hippodrome|pmu|pari|parier|mise|cote|value|edge|selection|ticket|pronostic|resultat|arrivee|gagnant|place|perdu|jouer|surveiller|eviter|rival|compare|score)\b/.test(
      normalized
    )
  );
}

function getCoachIntent(question: string): CoachIntent {
  const normalized = normalizeText(question);
  const hint = extractRaceHint(question);

  if (/\b(value|edge|cote|prix|surevalue|sure value|opportunite)\b/.test(normalized)) {
    return "value";
  }
  if (/\b(compare|comparaison|contre|versus|vs|rival|rivaux)\b/.test(normalized)) {
    return "compare";
  }
  if (/\b(resultat|arrive|arrivee|fini|termine|place|gagnant|perdu)\b/.test(normalized)) {
    return "result";
  }
  if (/\b(eviter|piege|danger|mauvais|risque|tocard|passer)\b/.test(normalized)) {
    return "avoid";
  }
  if (/\b(premium|abonnement|abonne|pro|membre|gratuit|prive|flou|masque|cache|debloque|deverrouille)\b/.test(normalized)) {
    return "premium";
  }
  if (/\b(pourquoi|explique|explication|raison|argument|detail|analyse detaillee|choisir|choix)\b/.test(normalized)) {
    return "why";
  }
  if (/\b(meilleur|top|selection|prioritaire|cheval du jour|ticket du jour)\b/.test(normalized)) {
    return "best";
  }
  if (/\b(aide|comment|fonctionne|marche|utiliser|sert|tu fais quoi|commande|question)\b/.test(normalized)) {
    return "help";
  }
  if (
    /\b(bonjour|salut|hello|coucou|yo|bjr|bonsoir)\b/.test(normalized) &&
    !hasTurfSignal(question)
  ) {
    return "greeting";
  }
  if (hint.reunion !== null || hint.course !== null || hint.horseNumber !== null) {
    return "horse";
  }

  return "general";
}

function extractRaceHint(question: string): RaceHint {
  const normalized = normalizeText(question);
  const raceMatch = normalized.match(/\br\s*(\d{1,2})\s*c\s*(\d{1,2})\b/);
  const hashHorseMatch = question.match(/#\s*(\d{1,2})\b/);
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

function getOutcomeSortBoost(row: PredictionRow, outcome: RunnerOutcomeRow | undefined) {
  const finish = outcome?.ordre_arrivee ?? null;
  if (finish === 1 || row.resultat_gagnant === true) return 12;
  if ((finish !== null && finish <= 3) || row.resultat_place === true) return 7;
  if (finish !== null) return -4;
  return 3;
}

function isResolvedRunner(row: PredictionRow, outcome: RunnerOutcomeRow | undefined) {
  return (
    outcome?.ordre_arrivee !== null && outcome?.ordre_arrivee !== undefined
  ) || row.resultat_gagnant !== null || row.resultat_place !== null;
}

function getOpportunityScore(row: PredictionRow, outcome: RunnerOutcomeRow | undefined) {
  const value = row.value ?? 0;
  const odds = getOdds(row) ?? 0;
  const valueBoost = value >= 0 ? value * 120 : value * 90;
  const oddsBoost = odds >= 2 && odds <= 9 ? 6 : odds > 12 ? -5 : 0;

  return (
    getPredictionScore(row) +
    (row.confiance ?? 0) * 4 +
    getDecisionPriority(row) * 18 +
    valueBoost +
    oddsBoost +
    getOutcomeSortBoost(row, outcome)
  );
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
  const intent = getCoachIntent(question);
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
  const latestDate = scored.reduce(
    (latest, item) => (item.row.date > latest ? item.row.date : latest),
    ""
  );
  const scoped = hasDirectMatch
    ? scored
    : scored.filter((item) => item.row.date === latestDate);
  const source = scoped.length > 0 ? scoped : scored;
  const hasPendingOpportunity = source.some((item) => {
    const outcome = outcomeByRunner.get(getRunnerKey(item.row));
    return (
      item.row.decision !== "REJET" &&
      !isResolvedRunner(item.row, outcome) &&
      (intent !== "value" || (item.row.value ?? 0) > 0)
    );
  });
  const selected = scored
    .filter((item) => source.includes(item))
    .filter((item) => {
      if (hasDirectMatch) return item.relevance > 0;
      const outcome = outcomeByRunner.get(getRunnerKey(item.row));
      if ((intent === "value" || intent === "best") && hasPendingOpportunity) {
        if (isResolvedRunner(item.row, outcome)) return false;
      }
      if (intent === "avoid") {
        return item.row.decision === "REJET" || (item.row.value ?? 0) < 0;
      }
      if (intent === "result") return item.row.decision !== "REJET";
      if (intent === "value") return item.row.decision !== "REJET" && (item.row.value ?? 0) > 0;
      return item.row.decision !== "REJET";
    })
    .sort((left, right) => {
      if (hasDirectMatch && right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }
      const leftOutcome = outcomeByRunner.get(getRunnerKey(left.row));
      const rightOutcome = outcomeByRunner.get(getRunnerKey(right.row));

      if (intent === "value") {
        const valueDiff = (right.row.value ?? -99) - (left.row.value ?? -99);
        if (valueDiff !== 0) return valueDiff;
        return getOpportunityScore(right.row, rightOutcome) - getOpportunityScore(left.row, leftOutcome);
      }
      if (intent === "result") {
        const rightResolved = rightOutcome?.ordre_arrivee ? 1 : 0;
        const leftResolved = leftOutcome?.ordre_arrivee ? 1 : 0;
        if (rightResolved !== leftResolved) return rightResolved - leftResolved;
      }
      if (intent === "avoid") {
        const leftRisk = (left.row.value ?? 0) + getPredictionScore(left.row) / 100;
        const rightRisk = (right.row.value ?? 0) + getPredictionScore(right.row) / 100;
        return leftRisk - rightRisk;
      }

      const dateCompare = right.row.date.localeCompare(left.row.date);
      if (dateCompare !== 0) return dateCompare;
      return getOpportunityScore(right.row, rightOutcome) - getOpportunityScore(left.row, leftOutcome);
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

export function getCoachIntentForQuestion(question: string): CoachIntent {
  return getCoachIntent(question);
}

export function buildCoachSystemPrompt(accessLevel: CoachAccessLevel) {
  const premiumRule =
    accessLevel === "premium"
      ? "L'utilisateur est Premium: tu peux mentionner scores, mises, cotes, value et resultats fournis."
      : "L'utilisateur est en apercu: ne revele pas les mises exactes; explique que le detail complet est Premium.";

  return [
    "Tu es un assistant integre a un site PMU.",
    "Tu reponds en francais clair, simple et utile.",
    "Tu expliques sans jargon inutile.",
    "Tu aides l'utilisateur a comprendre les courses, les paris, les bases, les outsiders, les chevaux a eviter et les notions turf.",
    "Si une information manque, tu le dis clairement sans inventer.",
    premiumRule,
    "Regles strictes:",
    "- Reponds uniquement avec les donnees du CONTEXTE_TURFEDGE.",
    "- Si une information manque, dis clairement: donnees insuffisantes.",
    "- Ne promets jamais un gain et ne donne jamais de certitude.",
    "- Reponds en francais simple, direct et structure.",
    "- Donne d'abord une lecture courte en une phrase.",
    "- Puis structure la reponse avec 3 a 5 points maximum: signal, prix/cote, risque, action.",
    "- Fais des phrases courtes. Pas de paragraphe geant.",
    "- Si tu cites plusieurs chevaux, hierarchise clairement base / rival / outsider / evitement.",
    "- N'affiche jamais de jargon technique sur le modele, l'API ou l'infrastructure.",
    "- Termine par une phrase courte de jeu responsable.",
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

function getInsightTone(item: CoachContextItem): CoachInsight["tone"] {
  if (item.decision === "REJET") return "red";
  if (item.decision === "SURVEILLANCE") return "orange";
  if ((item.value ?? 0) < 0) return "orange";
  return "green";
}

function getMetricTone(value: number | null, goodThreshold: number, watchThreshold: number) {
  if (value === null || !Number.isFinite(value)) return "neutral" as const;
  if (value >= goodThreshold) return "green" as const;
  if (value >= watchThreshold) return "orange" as const;
  return "red" as const;
}

function getResultMetricTone(result: string) {
  if (result === "GAGNANT" || result === "PLACE") return "green" as const;
  if (result === "PERDU") return "red" as const;
  return "neutral" as const;
}

function getPrimaryVerdict(item: CoachContextItem) {
  if (item.decision === "VALIDE" && (item.value ?? 0) >= 0.05) return "Jouer avec discipline";
  if (item.decision === "VALIDE") return "Bon profil, prix a surveiller";
  if (item.decision === "SURVEILLANCE") return "Surveillance active";
  return "Passer";
}

function joinAnswer(lines: string[]) {
  return lines.filter(Boolean).join("\n");
}

function getRunnerLabel(item: CoachContextItem) {
  return `${item.race} #${item.horseNumber} ${item.horseName}`;
}

function getShortStake(item: CoachContextItem, accessLevel: CoachAccessLevel) {
  if (accessLevel !== "premium") return "mise reservee Premium";
  if (item.stake === null || item.stake <= 0) return "mise --";
  return `mise ${formatValue(item.stake, " EUR")}`;
}

function getShortOdds(item: CoachContextItem) {
  return item.odds === null ? "cote --" : `cote ${item.odds}`;
}

function getShortValue(item: CoachContextItem) {
  return item.value === null ? "value --" : `value ${item.value}`;
}

function getShortRunnerLine(item: CoachContextItem, accessLevel: CoachAccessLevel) {
  return `${getRunnerLabel(item)}: ${item.decision}, score ${item.score}/100, ${getShortOdds(
    item
  )}, ${getShortValue(item)}, ${getShortStake(item, accessLevel)}.`;
}

function getNoContextAnswer(intent: CoachIntent) {
  if (intent === "result") {
    return joinAnswer([
      "Je n'ai pas encore assez d'arrivee consolidee pour ce cheval ou cette course.",
      "Donne-moi un format precis du type R1C4 #7, ou reessaie quand les resultats PMU sont synchronises.",
      "Jeu responsable: un resultat passe sert a mesurer, pas a garantir le prochain.",
    ]);
  }

  if (intent === "compare") {
    return joinAnswer([
      "Je n'ai pas assez de chevaux dans la meme course pour faire une vraie comparaison.",
      "Donne-moi une course precise comme R1C4, ou un cheval avec son numero, et je compare les rivaux directs.",
      "Jeu responsable: une comparaison reduit le bruit, elle ne supprime jamais le risque.",
    ]);
  }

  return joinAnswer([
    "Je n'ai pas assez de donnees TurfEdge pour repondre proprement a cette question.",
    "Donne-moi un format du type R1C4 #7, le nom exact du cheval, ou demande: meilleur cheval, value bet, cheval a eviter.",
    "Jeu responsable: un pronostic reste une aide a la decision, jamais une garantie.",
  ]);
}

function buildBestAnswer(context: CoachContextItem[], accessLevel: CoachAccessLevel) {
  const first = context[0];
  const challengers = context.slice(1, 4);

  return joinAnswer([
    `La selection la plus propre maintenant: ${getRunnerLabel(first)}.`,
    `Pourquoi: ${getDecisionLabel(first)}, score ${first.score}/100, confiance ${formatConfidence(
      first.confidence
    )}, ${getShortOdds(first)}, ${getShortValue(first)}.`,
    getStakeRead(first, accessLevel),
    challengers.length
      ? `Derriere lui: ${challengers
          .map((item) => `${getRunnerLabel(item)} (${item.score}/100)`)
          .join(", ")}.`
      : "Derriere lui: donnees insuffisantes pour hierarchiser proprement.",
    getFinalAdvice(first),
    "Jeu responsable: mise petite, decision froide.",
  ]);
}

function buildValueAnswer(context: CoachContextItem[], accessLevel: CoachAccessLevel) {
  const valueItems = context
    .filter((item) => item.value !== null && item.value > 0)
    .slice(0, 3);
  const items = valueItems.length ? valueItems : context.slice(0, 3);
  const first = items[0];

  return joinAnswer([
    "Je te reponds sur la value: je cherche le prix qui paye mieux que le risque estime.",
    ...items.map((item, index) => `${index + 1}. ${getShortRunnerLine(item, accessLevel)}`),
    first ? `Mon choix value: ${getRunnerLabel(first)} si la cote reste stable.` : "",
    first ? getRiskRead(first) : "",
    "Jeu responsable: value ne veut pas dire certitude, ca veut dire meilleur prix relatif.",
  ]);
}

function buildAvoidAnswer(context: CoachContextItem[]) {
  const items = context.slice(0, 3);
  const first = items[0];

  return joinAnswer([
    first
      ? `Celui que je laisse de cote en priorite: ${getRunnerLabel(first)}.`
      : "Je n'ai pas de rejet net dans les donnees actuelles.",
    ...items.map((item, index) => {
      const valueRead =
        item.value === null ? "value indisponible" : `value ${item.value}`;
      return `${index + 1}. ${getRunnerLabel(item)}: ${item.decision}, score ${item.score}/100, ${valueRead}.`;
    }),
    first ? getRiskRead(first) : "",
    "Ma decision: pas de mise tant que le prix ou le signal ne change pas.",
    "Jeu responsable: savoir passer une course, c'est deja gagner du controle.",
  ]);
}

function buildResultAnswer(context: CoachContextItem[]) {
  const first = context[0];
  const others = context
    .slice(1, 4)
    .filter((item) => item.result !== "EN_ATTENTE");

  return joinAnswer([
    `${getRunnerLabel(first)}: ${getResultRead(first)}`,
    first.finishPosition ? `Place exacte: ${formatFinishPosition(first.finishPosition)}.` : "",
    others.length
      ? `Autres resultats trouves: ${others
          .map((item) => `${getRunnerLabel(item)} ${item.result}${item.finishPosition ? ` ${formatFinishPosition(item.finishPosition)}` : ""}`)
          .join(", ")}.`
      : "Je n'ai pas d'autre arrivee consolidee utile dans ce contexte.",
    "Jeu responsable: les resultats servent a verifier la methode, pas a courir apres les pertes.",
  ]);
}

function buildCompareAnswer(context: CoachContextItem[], accessLevel: CoachAccessLevel) {
  const first = context[0];
  const rivals = getSameRaceRivals(first, context);
  const fallbackRivals = rivals.length ? rivals : context.slice(1, 4);

  return joinAnswer([
    `Comparaison autour de ${getRunnerLabel(first)}.`,
    `Base: ${getShortRunnerLine(first, accessLevel)}`,
    fallbackRivals.length
      ? `Rivaux: ${fallbackRivals
          .map((item) => `${getRunnerLabel(item)} (${item.score}/100, ${getShortValue(item)})`)
          .join(" | ")}.`
      : "Rivaux: donnees insuffisantes pour comparer proprement.",
    fallbackRivals[0] && first.score - fallbackRivals[0].score < 5
      ? "Lecture: ecart faible, je ne surmiserais pas ce cheval sans cote interessante."
      : "Lecture: le premier garde l'avantage dans les signaux disponibles.",
    getFinalAdvice(first),
    "Jeu responsable: comparer sert a choisir moins souvent, mais mieux.",
  ]);
}

function buildWhyAnswer(context: CoachContextItem[], accessLevel: CoachAccessLevel) {
  const first = context[0];

  return joinAnswer([
    `Pourquoi je lis ${getRunnerLabel(first)} comme ca:`,
    `1. Decision: ${first.decision}, donc ${getDecisionLabel(first)}.`,
    `2. Niveau: score ${first.score}/100 et confiance ${formatConfidence(first.confidence)}.`,
    `3. Prix: ${getShortOdds(first)} et ${getShortValue(first)}.`,
    `4. Discipline de mise: ${getShortStake(first, accessLevel)}.`,
    getRiskRead(first),
    getRivalRead(first, context),
    getFinalAdvice(first),
    "Jeu responsable: l'analyse explique un choix, elle ne transforme pas une course en certitude.",
  ]);
}

function buildHorseAnswer(context: CoachContextItem[], accessLevel: CoachAccessLevel) {
  const first = context[0];

  return joinAnswer([
    `Sur ${getRunnerLabel(first)}, ma lecture est: ${getPrimaryVerdict(first)}.`,
    `Les chiffres utiles: score ${first.score}/100, confiance ${formatConfidence(first.confidence)}, ${getShortOdds(
      first
    )}, ${getShortValue(first)}.`,
    getStakeRead(first, accessLevel),
    getRiskRead(first),
    getResultRead(first),
    getRivalRead(first, context),
    getFinalAdvice(first),
    "Jeu responsable: pas de mise automatique, seulement si la cote reste correcte.",
  ]);
}

export function buildDirectCoachAnswer(
  question: string,
  accessLevel: CoachAccessLevel
) {
  const intent = getCoachIntent(question);

  if (intent === "greeting") {
    return joinAnswer([
      "Salut, je suis le Coach TurfEdge.",
      "Pose-moi une vraie question libre: un cheval, une course, une value, un resultat, ou meme pourquoi un profil est flou.",
      "Exemples: R1C4 #7, compare R3C2, quel cheval eviter aujourd'hui ?",
    ]);
  }

  if (intent === "help") {
    return joinAnswer([
      "Je fonctionne avec les donnees Supabase TurfEdge: predictions, scores, cotes, value, mises et arrivees.",
      "Tu peux me demander: avis sur un cheval, meilleure selection, value bet, cheval a eviter, resultat, ou comparaison dans une course.",
      "Formats rapides: R1C4 #7, nom du cheval, compare R1C4, pourquoi cette selection ?",
      accessLevel === "premium"
        ? "Ton mode Premium permet les details complets: score, edge, mise et analyse."
        : "En apercu, je garde les mises et details sensibles pour les membres Premium.",
    ]);
  }

  if (intent === "premium") {
    return accessLevel === "premium"
      ? joinAnswer([
          "Je te vois en mode Premium quand ton token de session arrive bien jusqu'a l'API.",
          "En Premium, tu dois avoir: top complet, scores, edge/value, mises conseillees, analyses detaillees et Telegram premium.",
          "Si une zone reste floue alors que tu es connecte, le souci vient souvent d'une session non rafraichie ou d'un appel sans token. Deconnexion/reconnexion corrige souvent ca.",
        ])
      : joinAnswer([
          "La, je te vois en apercu.",
          "Un non-abonne peut comprendre la logique generale, mais les mises, edges complets et analyses profondes restent bloques.",
          "Pour tout debloquer: passe Premium puis reconnecte-toi pour que le site renvoie bien ton token au coach.",
        ]);
  }

  if (intent === "general" && !hasTurfSignal(question)) {
    return joinAnswer([
      "Je peux te repondre, mais j'ai besoin d'un angle TurfEdge pour etre utile.",
      "Donne-moi un cheval, une course, un resultat, une comparaison, ou demande le meilleur value bet du jour.",
      "Exemple concret: Tu penses quoi de R1C4 #7 ?",
    ]);
  }

  return null;
}

export function buildCoachInsight(
  question: string,
  context: CoachContextItem[],
  accessLevel: CoachAccessLevel
): CoachInsight | null {
  if (context.length === 0) {
    return null;
  }

  const first = context[0];
  const rivals = getSameRaceRivals(first, context);
  const stakeValue =
    accessLevel === "premium"
      ? first.stake === null
        ? "--"
        : `${first.stake} EUR`
      : "Premium";

  return {
    intent: getCoachIntent(question),
    title: `${first.race} #${first.horseNumber} ${first.horseName}`,
    subtitle: first.meta ? `${first.hippodrome} - ${first.meta}` : first.hippodrome,
    verdict: getPrimaryVerdict(first),
    tone: getInsightTone(first),
    action: getFinalAdvice(first),
    metrics: [
      {
        label: "Score",
        value: `${first.score}/100`,
        tone: getMetricTone(first.score, 75, 58),
      },
      {
        label: "Confiance",
        value: formatConfidence(first.confidence),
        tone: getMetricTone(first.confidence, 8, 6),
      },
      {
        label: "Cote",
        value: formatValue(first.odds),
        tone: first.odds !== null && first.odds >= 2 && first.odds <= 9 ? "green" : "neutral",
      },
      {
        label: "Value",
        value: formatValue(first.value),
        tone: getMetricTone(first.value, 0.12, 0),
      },
      {
        label: "Mise",
        value: stakeValue,
        tone: accessLevel === "premium" && first.stake ? "green" : "neutral",
      },
      {
        label: "Arrivee",
        value:
          first.result === "EN_ATTENTE"
            ? "En attente"
            : `${first.result}${first.finishPosition ? ` ${formatFinishPosition(first.finishPosition)}` : ""}`,
        tone: getResultMetricTone(first.result),
      },
    ],
    facts: [
      getValueRead(first),
      getRiskRead(first),
      getResultRead(first),
    ],
    rivals: rivals.map((rival) => ({
      label: `#${rival.horseNumber} ${rival.horseName}`,
      score: `${rival.score}/100`,
    })),
  };
}

export function buildFallbackCoachAnswer(
  question: string,
  context: CoachContextItem[],
  accessLevel: CoachAccessLevel
) {
  const directAnswer = buildDirectCoachAnswer(question, accessLevel);
  if (directAnswer) {
    return directAnswer;
  }

  const intent = getCoachIntent(question);

  if (context.length === 0) {
    return getNoContextAnswer(intent);
  }

  if (intent === "best") return buildBestAnswer(context, accessLevel);
  if (intent === "value") return buildValueAnswer(context, accessLevel);
  if (intent === "avoid") return buildAvoidAnswer(context);
  if (intent === "result") return buildResultAnswer(context);
  if (intent === "compare") return buildCompareAnswer(context, accessLevel);
  if (intent === "why") return buildWhyAnswer(context, accessLevel);

  return buildHorseAnswer(context, accessLevel);
}
