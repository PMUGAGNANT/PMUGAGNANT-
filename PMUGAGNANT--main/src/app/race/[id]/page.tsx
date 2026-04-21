import type { Metadata } from "next";
import Link from "next/link";
import DashboardHeaderAccount from "@/components/dashboard/DashboardHeaderAccount";
import RaceAlertButton from "@/components/race/RaceAlertButton";
import RaceChat from "@/components/race/RaceChat";
import ScoreGauge from "@/components/ui/ScoreGauge";
import {
  buildValueBets,
  computeRaceVerdict,
  formatRaceAnalysisId,
  formatOdds,
  formatStakeEuro,
  getVmaxRaceStatus,
  parseRaceAnalysisId,
  type ParticipantTableRow,
} from "@/features/vmax/vmax-model";
import { analyzeRaceWithParameters } from "@/lib/analysis";
import { loadAlgoParameters } from "@/lib/config";
import { fromIsoDate, getMinutesUntilStart, getTodayDateStr, toIsoDate } from "@/lib/date-utils";
import { attachFaultRates } from "@/lib/horse-faults";
import { getAllRaces, getArriveeCourse, getCotesDirectes, getParticipants } from "@/lib/pmu-api";
import {
  getRacePredictions,
  listLatestRunnerScoreSnapshotsForRace,
  listCourseRecordsBetween,
  listPredictionsBetween,
} from "@/lib/prediction-store";
import { normalizeRequestedDate } from "@/lib/request-utils";
import type { RaceRoleV10Key } from "@/lib/predictions/roles-v10";
import { logger } from "@/lib/server-logger";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import type {
  CourseRecordRow,
  Participant,
  PredictionRow,
  RaceAnalysis,
  RaceSummary,
  RunnerScoreSnapshotRow,
  ScoredParticipant,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "Analyse course - PMU Gagnant",
  description:
    "Analyse IA d'une course PMU : tableau des partants, scores, cotes, forme, mises conseillÃ©es et value bets.",
};

export const dynamic = "force-dynamic";

type RacePageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ date?: string | string[] }>;
};

type RacePageState =
  | { kind: "invalid" }
  | { kind: "not-found"; date: string }
  | { kind: "error" }
  | {
      kind: "ready";
      courseInfo: RaceSummary;
      analysis: RaceAnalysis | null;
      rows: ParticipantTableRow[];
      dataBadge: "Supabase" | "DonnÃ©es J-1" | "Live PMU";
      arrivee: number[] | null;
      cotesLive: boolean;
    };

type RaceMessageRow = Database["public"]["Tables"]["race_messages"]["Row"];
type RaceReactionRow = Database["public"]["Tables"]["race_message_reactions"]["Row"];
type ReactionEmoji = RaceReactionRow["emoji"];
type RaceChatMessage = RaceMessageRow & {
  reactions: {
    emoji: ReactionEmoji;
    count: number;
    reactedByMe: boolean;
  }[];
};

function getSearchDate(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeHorseJoinKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();
}

function getFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstFiniteNumber(...values: Array<number | null | undefined>) {
  for (const value of values) {
    const numeric = getFiniteNumber(value);
    if (numeric !== null) return numeric;
  }
  return null;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function getUnknownNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRaceRoleV10(value: unknown): value is RaceRoleV10Key {
  return (
    value === "CHOIX" || value === "PEPITE" || value === "CHASSEUR" ||
    value === "PODIUM" || value === "OUTSIDER"
  );
}

function getSnapshotV10(snapshot: RunnerScoreSnapshotRow | undefined) {
  const payload = getRecord(snapshot?.blend_payload);
  const v10 = getRecord(payload?.v101) ?? getRecord(payload?.v10);
  const criteria = getRecord(v10?.criteria);
  const market = getRecord(payload?.market);
  const role = v10?.role;
  const betType = v10?.betType;
  const parsedBetType: "GAGNANT" | "PLACE" | null =
    betType === "GAGNANT" || betType === "PLACE" ? betType : null;
  return {
    score: firstFiniteNumber(snapshot?.score_v10_1, getUnknownNumber(v10?.score), snapshot?.score_v10),
    role: isRaceRoleV10(role) ? role : null,
    betType: parsedBetType,
    criteria: {
      forme: getUnknownNumber(criteria?.forme) ?? 0,
      value: getUnknownNumber(criteria?.value) ?? 0,
      jockeyHippodrome: getUnknownNumber(criteria?.jockeyHippodrome) ?? 0,
      distance: getUnknownNumber(criteria?.distance) ?? 0,
    },
    cote: firstFiniteNumber(getUnknownNumber(market?.coteMatin), getUnknownNumber(market?.coteDepart)),
    jockeyWinRate: getUnknownNumber(v10?.jockeyWinRate),
    roleLabel: getString(v10?.roleLabel),
    roleEmoji: getString(v10?.roleEmoji),
  };
}

function buildArriveeFromParticipants(participants: Participant[]) {
  const arrivee = participants
    .filter(
      (participant) =>
        typeof participant.ordreArrivee === "number" &&
        Number.isInteger(participant.ordreArrivee) &&
        participant.ordreArrivee > 0
    )
    .sort((left, right) => Number(left.ordreArrivee) - Number(right.ordreArrivee))
    .map((participant) => participant.numPmu);

  return arrivee.length > 0 ? arrivee : null;
}

function buildParticipantRows(
  participants: Participant[],
  ranking: ScoredParticipant[],
  storedRows: PredictionRow[] = [],
  scoreSnapshots: RunnerScoreSnapshotRow[] = [],
  forcedSource: ParticipantTableRow["scoreSource"] | null = null
): ParticipantTableRow[] {
  const rankedByNumber = new Map<number, ScoredParticipant>();
  for (const runner of ranking) rankedByNumber.set(runner.numPmu, runner);
  const snapshotByNumber = new Map<number, RunnerScoreSnapshotRow>();
  for (const snapshot of scoreSnapshots) snapshotByNumber.set(snapshot.cheval_num, snapshot);
  const storedByNumber = new Map<number, PredictionRow>();
  const storedByName = new Map<string, PredictionRow>();
  for (const row of storedRows) {
    storedByNumber.set(row.cheval_num, row);
    storedByName.set(normalizeHorseJoinKey(row.cheval_nom), row);
  }
  return participants
    .filter((participant) => !participant.nonPartant)
    .map((participant) => {
      const runner = rankedByNumber.get(participant.numPmu);
      const snapshot = snapshotByNumber.get(participant.numPmu);
      const stored =
        storedByNumber.get(participant.numPmu) ??
        storedByName.get(normalizeHorseJoinKey(participant.nom));
      const v10 = getSnapshotV10(snapshot);
      const score = firstFiniteNumber(
        stored?.score_blended, stored?.score_cheval, stored?.score_final_pari,
        snapshot?.score_lisibilite_adjusted, snapshot?.score_expert,
        runner?.prediction.scoreBlended, runner?.prediction.scoreCheval, runner?.prediction.scoreFinalPari
      );
      const cote = firstFiniteNumber(
        stored?.cote_depart, stored?.cote_matin, participant.cote,
        runner?.cote, runner?.coteDepart
      );
      const hasStoredScore = firstFiniteNumber(stored?.score_blended, stored?.score_cheval, stored?.score_final_pari) !== null;
      const hasSnapshotScore = firstFiniteNumber(snapshot?.score_lisibilite_adjusted, snapshot?.score_expert) !== null;
      const storedStake = firstFiniteNumber(stored?.mise_simulee, snapshot?.stake_final);
      return {
        numero: participant.numPmu,
        cheval: participant.nom,
        jockey: participant.jockey || participant.driver || "â€”",
        entraineur: participant.entraineur || "â€”",
        cote,
        scoreIa: score,
        scoreV10: v10.score,
        scoreV10Role: v10.role,
        scoreV10Criteria: v10.score !== null ? v10.criteria : null,
        scoreV10BetType: v10.betType,
        scoreV10Cote: v10.cote,
        scoreV10JockeyRate: v10.jockeyWinRate,
        scoreSource: forcedSource ?? (hasStoredScore || hasSnapshotScore ? "supabase" : runner ? "engine" : "fallback"),
        musique: participant.musique || runner?.musique || null,
        mise: storedStake !== null && storedStake > 0 ? storedStake : null,
        topFacteur: runner?.prediction.topFacteurs[0] ?? stored?.avis_texte ?? null,
      };
    })
    .sort((left, right) => left.numero - right.numero);
}

function getPredictionScore(row: PredictionRow) {
  return firstFiniteNumber(row.score_blended, row.score_cheval, row.score_final_pari);
}

function getPredictionOdds(row: PredictionRow) {
  return firstFiniteNumber(row.cote_depart, row.cote_matin);
}

function buildRowsFromPredictions(rows: PredictionRow[]): ParticipantTableRow[] {
  return rows
    .map((row) => ({
      numero: row.cheval_num,
      cheval: row.cheval_nom,
      jockey: "â€”",
      entraineur: "â€”",
      cote: getPredictionOdds(row),
      scoreIa: getPredictionScore(row),
      scoreSource: "fallback" as const,
      musique: null,
      mise: row.mise_simulee > 0 ? row.mise_simulee : null,
      topFacteur: row.avis_texte ?? null,
    }))
    .sort((left, right) => left.numero - right.numero);
}

function raceSummaryFromCourseRecord(record: CourseRecordRow): RaceSummary {
  return {
    dateStr: fromIsoDate(record.date),
    reunion: record.reunion,
    course: record.course,
    hippodrome: record.hippodrome,
    pays: "FRA",
    nomCourse: record.nom_course,
    heureDepart: record.heure_depart,
    discipline: record.discipline,
    estTrot: record.discipline.includes("TROT"),
    estPlat: record.discipline === "PLAT",
    estQuinte: record.decision_course !== null,
    allocation: record.allocation,
    distance: record.distance,
    nombrePartants: record.nombre_partants,
    terrain: record.terrain ?? null,
    meteo: record.meteo ?? null,
  };
}

function raceSummaryFromPredictionRows(rows: PredictionRow[], fallbackDate: string): RaceSummary | null {
  const first = rows[0];
  if (!first) return null;
  return {
    dateStr: fromIsoDate(first.date || fallbackDate),
    reunion: first.reunion,
    course: first.course,
    hippodrome: first.hippodrome,
    pays: "FRA",
    nomCourse: `R${first.reunion}C${first.course}`,
    heureDepart: "12:00",
    discipline: "PMU",
    estTrot: false,
    estPlat: false,
    estQuinte: false,
    allocation: 0,
    distance: 0,
    nombrePartants: rows.length,
    terrain: null,
    meteo: null,
  };
}

function getLatestRaceRows(rows: PredictionRow[]) {
  const sorted = [...rows].sort((left, right) => {
    if (left.date !== right.date) return right.date.localeCompare(left.date);
    if (left.reunion !== right.reunion) return left.reunion - right.reunion;
    return left.course - right.course;
  });
  const first = sorted[0];
  if (!first) return [];
  return sorted.filter(
    (row) => row.date === first.date && row.reunion === first.reunion && row.course === first.course
  );
}

async function loadLatestStoredRaceFallback(excluded: { dateIso: string; reunion: number; course: number }) {
  const endIso = excluded.dateIso;
  const startDate = new Date(`${endIso}T12:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 14);
  const startIso = startDate.toISOString().slice(0, 10);
  const [predictionRows, courseRows] = await Promise.all([
    listPredictionsBetween(startIso, endIso).catch(() => []),
    listCourseRecordsBetween(startIso, endIso).catch(() => []),
  ]);
  const candidates = predictionRows.filter(
    (row) => row.date !== excluded.dateIso || row.reunion !== excluded.reunion || row.course !== excluded.course
  );
  const latestRows = getLatestRaceRows(candidates);
  const first = latestRows[0];
  if (!first) return null;
  const courseRecord = courseRows.find(
    (row) => row.date === first.date && row.reunion === first.reunion && row.course === first.course
  );
  return {
    courseInfo: courseRecord
      ? raceSummaryFromCourseRecord(courseRecord)
      : raceSummaryFromPredictionRows(latestRows, first.date),
    rows: buildRowsFromPredictions(latestRows),
  };
}

function getRecommendedRow(rows: ParticipantTableRow[], analysis: RaceAnalysis | null) {
  const v10Choice = rows.find((item) => item.scoreV10Role === "CHOIX");
  if (v10Choice) return v10Choice;
  const bestV10 = rows
    .filter((item) => typeof item.scoreV10 === "number" && Number.isFinite(item.scoreV10))
    .sort((left, right) => (right.scoreV10 ?? 0) - (left.scoreV10 ?? 0))[0];
  if (bestV10) return bestV10;
  const analysisPick = analysis?.favori?.numPmu ?? null;
  if (analysisPick !== null) {
    const row = rows.find((item) => item.numero === analysisPick);
    if (row) return row;
  }
  return [...rows].sort((left, right) => (right.scoreIa ?? 0) - (left.scoreIa ?? 0))[0] ?? null;
}

async function countRaceAlerts(dateStr: string, reunion: number, course: number) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { count, error } = await admin
    .from("race_alerts")
    .select("id", { count: "exact", head: true })
    .eq("date_str", dateStr)
    .eq("reunion", reunion)
    .eq("course", course)
    .eq("status", "ACTIVE");
  if (error) return null;
  return count ?? null;
}

function buildServerReactionSummaries(messageIds: string[], rows: RaceReactionRow[]) {
  const emojis: ReactionEmoji[] = ["🔥", "👀", "❌"];
  const grouped = new Map<RaceMessageRow["id"], RaceChatMessage["reactions"]>();
  for (const id of messageIds) {
    grouped.set(id, emojis.map((emoji) => ({ emoji, count: 0, reactedByMe: false })));
  }
  for (const row of rows) {
    const reactions = grouped.get(row.message_id);
    const reaction = reactions?.find((item) => item.emoji === row.emoji);
    if (reaction) reaction.count += 1;
  }
  return grouped;
}

async function loadInitialRaceChatMessages(raceId: string, raceDate: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return [];
  const { data: messageData, error: messageError } = await admin
    .from("race_messages")
    .select("*")
    .eq("race_id", raceId)
    .eq("race_date", raceDate)
    .order("created_at", { ascending: false })
    .limit(50);
  if (messageError) {
    logger.warn("race_chat.initial_messages_failed", { raceId, raceDate, error: messageError.message });
    return [];
  }
  const messages = ((messageData ?? []) as RaceMessageRow[]).reverse();
  const messageIds = messages.map((message) => message.id);
  if (messageIds.length === 0) return [];
  const { data: reactionData, error: reactionError } = await admin
    .from("race_message_reactions")
    .select("*")
    .in("message_id", messageIds);
  if (reactionError) {
    logger.warn("race_chat.initial_reactions_failed", { raceId, raceDate, error: reactionError.message });
  }
  const reactionsByMessage = buildServerReactionSummaries(messageIds, (reactionData ?? []) as RaceReactionRow[]);
  return messages.map((message) => ({
    ...message,
    reactions: reactionsByMessage.get(message.id) ?? [],
  })) satisfies RaceChatMessage[];
}

function getGaugeScore(analysis: RaceAnalysis | null, selectedRow: ParticipantTableRow | null) {
  if (typeof selectedRow?.scoreV10 === "number" && Number.isFinite(selectedRow.scoreV10)) {
    return Math.max(0, Math.min(100, Math.round(selectedRow.scoreV10)));
  }
  const confidence = analysis?.scoreConfiance?.score ?? analysis?.favori?.prediction.confiance ?? null;
  if (typeof confidence === "number" && Number.isFinite(confidence)) {
    return Math.max(0, Math.min(100, Math.round(confidence * 10)));
  }
  return Math.max(0, Math.min(100, Math.round(selectedRow?.scoreIa ?? 0)));
}

function getValueExplanation(value: string | null | undefined) {
  return value ?? "L'IA dÃ©tecte un Ã©cart positif entre le prix PMU et la probabilitÃ© estimÃ©e.";
}

function getRaceStatus(courseInfo: RaceSummary, predictions: PredictionRow[]) {
  const finished = predictions.some(
    (prediction) => prediction.resultat_gagnant !== null || prediction.resultat_place !== null
  );
  return getVmaxRaceStatus(
    finished ? "finished" : null,
    getMinutesUntilStart(courseInfo.heureDepart, courseInfo.dateStr)
  );
}

async function loadRacePageData(id: string, requestedDate: string): Promise<RacePageState> {
  const parsed = parseRaceAnalysisId(id);
  if (!parsed) return { kind: "invalid" };
  const excluded = { dateIso: toIsoDate(requestedDate), reunion: parsed.reunion, course: parsed.course };
  try {
    const [races, algoParameters] = await Promise.all([getAllRaces(requestedDate), loadAlgoParameters()]);
    const courseInfo = races.find((race) => race.reunion === parsed.reunion && race.course === parsed.course);
    if (!courseInfo) {
      const fallback = await loadLatestStoredRaceFallback(excluded);
      if (fallback?.courseInfo && fallback.rows.length > 0) {
        return { kind: "ready", courseInfo: fallback.courseInfo, analysis: null, rows: fallback.rows, dataBadge: "DonnÃ©es J-1", arrivee: null, cotesLive: false };
      }
      return { kind: "not-found", date: requestedDate };
    }
    const [storedRows, scoreSnapshots] = await Promise.all([
      getRacePredictions(requestedDate, parsed.reunion, parsed.course).catch(() => []),
      listLatestRunnerScoreSnapshotsForRace(requestedDate, parsed.reunion, parsed.course).catch((scoreError: unknown) => {
        logger.warn("race_page.score_snapshot_fallback_failed", { id, requestedDate, error: scoreError instanceof Error ? scoreError.message : String(scoreError) });
        return [] as RunnerScoreSnapshotRow[];
      }),
    ]);
    if (storedRows.length === 0 && scoreSnapshots.length === 0) {
      const fallback = await loadLatestStoredRaceFallback(excluded);
      if (fallback?.courseInfo && fallback.rows.length > 0) {
        return { kind: "ready", courseInfo: fallback.courseInfo, analysis: null, rows: fallback.rows, dataBadge: "DonnÃ©es J-1", arrivee: null, cotesLive: false };
      }
    }
    const participants = await attachFaultRates(await getParticipants(requestedDate, parsed.reunion, parsed.course));
    const analysis = participants.length > 0 ? analyzeRaceWithParameters(courseInfo, participants, algoParameters) : null;
    const minutesUntilStart = getMinutesUntilStart(courseInfo.heureDepart, courseInfo.dateStr);
    const raceStatus = getRaceStatus(courseInfo, storedRows);
    const shouldFetchArrivee = raceStatus === "finished" || minutesUntilStart < -30;
    const [pmuArrivee, cotesDirectes] = await Promise.all([
      shouldFetchArrivee
        ? getArriveeCourse(requestedDate, parsed.reunion, parsed.course)
        : Promise.resolve(null),
      !shouldFetchArrivee
        ? getCotesDirectes(requestedDate, parsed.reunion, parsed.course)
        : Promise.resolve(null),
    ]);
    const arrivee = pmuArrivee ?? (shouldFetchArrivee ? buildArriveeFromParticipants(participants) : null);
    const rows = buildParticipantRows(participants, analysis?.ranking ?? [], storedRows, scoreSnapshots)
      .map((row) => ({
        ...row,
        cote: cotesDirectes?.get(row.numero) ?? row.cote,
      }));
    return {
      kind: "ready",
      courseInfo,
      analysis,
      rows,
      dataBadge: storedRows.length > 0 || scoreSnapshots.length > 0 ? "Supabase" : "Live PMU",
      arrivee,
      cotesLive: Boolean(cotesDirectes && cotesDirectes.size > 0),
    };
  } catch (error) {
    logger.error("race_page.load_failed", error, { id, requestedDate });
    const fallback = await loadLatestStoredRaceFallback(excluded).catch(() => null);
    if (fallback?.courseInfo && fallback.rows.length > 0) {
      return { kind: "ready", courseInfo: fallback.courseInfo, analysis: null, rows: fallback.rows, dataBadge: "DonnÃ©es J-1", arrivee: null, cotesLive: false };
    }
    return { kind: "error" };
  }
}

// â”€â”€â”€ STYLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&family=Cormorant+Garamond:wght@600;700&display=swap');
.rp-wrap{--gold:#D4AF37;--green:#00C851;--orange:#FF9F1C;--red:#FF4D5A;--blue:#4DC8FF;--muted:rgba(255,255,255,0.35);--bg:#080A12;--panel:#10131F;--panel2:#151928;--line:rgba(255,255,255,0.12);min-height:100vh;background:var(--bg);color:#fff;font-family:"DM Mono",monospace}
.rp-nav{position:sticky;top:0;z-index:50;display:grid;grid-template-columns:auto auto 1fr auto;align-items:center;gap:18px;border-bottom:1px solid rgba(212,175,55,.18);background:rgba(8,10,18,.92);padding:14px 32px;backdrop-filter:blur(16px)}
.rp-logo{font-family:"Cormorant Garamond",serif;font-size:28px;font-weight:700;color:var(--gold);text-decoration:none;letter-spacing:.08em}
.rp-live{display:inline-flex;align-items:center;border:1px solid rgba(0,200,81,.45);border-radius:999px;background:rgba(0,200,81,.12);color:var(--green);padding:5px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em}
.rp-links{display:flex;justify-content:center;gap:8px}.rp-links a{border-radius:8px;color:rgba(255,255,255,.72);font-size:12px;font-weight:700;letter-spacing:.08em;padding:9px 12px;text-decoration:none;text-transform:uppercase}.rp-links a:hover{background:rgba(255,255,255,.08);color:var(--gold)}
.rp-burger{display:none;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.06);color:#fff;font-size:18px;padding:8px 11px}
.rp-body{max-width:1480px;margin:0 auto;padding:24px;display:grid;gap:16px}.rp-page-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start}.rp-main{display:grid;gap:18px}.rp-sidebar{display:grid;gap:16px}
.rp-course-header,.rp-card,.rp-scard{border:1px solid var(--line);border-radius:8px;background:var(--panel);box-shadow:0 24px 60px rgba(0,0,0,.24)}
.rp-course-header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:28px;background:radial-gradient(circle at 84% 16%,rgba(77,200,255,.14),transparent 26%),var(--panel)}
.rp-course-name{font-family:"Cormorant Garamond",serif;font-size:48px;font-weight:700;line-height:.95;color:#fff}.rp-course-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;color:rgba(255,255,255,.68);font-size:12px}.rp-course-meta-dot{width:4px;height:4px;border-radius:50%;background:var(--gold);margin-top:7px}
.rp-header-right{display:grid;justify-items:end;gap:14px}.rp-course-badge{border:1px solid rgba(77,200,255,.4);border-radius:999px;color:var(--blue);font-size:11px;font-weight:700;letter-spacing:.12em;padding:7px 12px;text-transform:uppercase}.rp-course-badge.live{border-color:rgba(0,200,81,.45);color:var(--green)}.rp-course-badge.termine{border-color:rgba(255,255,255,.18);color:var(--muted)}
.rp-official{border:1px solid rgba(212,175,55,0.2);border-radius:20px;background:linear-gradient(135deg,#0D1020,#131628);padding:24px 32px}.rp-official-title{color:#D4AF37;font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase}.rp-arrival-list{display:flex;align-items:start;justify-content:space-around;gap:18px;margin-top:18px}.rp-arrival-item{display:grid;justify-items:center;gap:8px;min-width:92px;text-align:center}.rp-arrival-head{display:grid;justify-items:center;gap:7px}.rp-arrival-rank{color:#D4AF37;font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}.rp-live-odds{color:var(--blue);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}.rp-arrival-num{display:grid;place-items:center;border-radius:50%;border:1px solid transparent;font-family:"Cormorant Garamond",serif;font-weight:700}.rp-arrival-num.gold{width:60px;height:60px;background:#D4AF37;box-shadow:0 0 30px rgba(212,175,55,.5);color:#080A12;font-size:30px}.rp-arrival-num.silver{width:52px;height:52px;background:rgba(192,192,192,.7);color:#080A12;font-size:26px}.rp-arrival-num.bronze{width:46px;height:46px;background:rgba(205,127,50,.8);color:#080A12;font-size:23px}.rp-arrival-num.fourth{width:40px;height:40px;border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.15);color:#fff;font-size:20px}.rp-arrival-num.fifth{width:36px;height:36px;border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:rgba(255,255,255,.78);font-size:18px}.rp-arrival-horse{max-width:108px;font-family:"Cormorant Garamond",serif;font-size:12px;font-weight:700;color:#fff;line-height:1.15}.rp-ai-badge{display:inline-flex;width:max-content;border-radius:20px;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.3);background:rgba(255,255,255,.05);font-size:10px;font-weight:700;letter-spacing:.12em;padding:3px 10px;text-transform:uppercase}.rp-ai-badge.ok{border-color:rgba(0,255,135,.3);color:#00FF87;background:rgba(0,255,135,.12)}.rp-ai-badge.ko{border-color:rgba(255,255,255,.1);color:rgba(255,255,255,.3);background:rgba(255,255,255,.05)}
.rp-card{overflow:hidden}.rp-card-header,.rp-stitle{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);color:var(--gold);font-size:11px;font-weight:700;letter-spacing:.18em;padding:14px 18px;text-transform:uppercase}.rp-sel-body{padding:24px 32px}.rp-bubbles{display:flex;align-items:flex-start;justify-content:space-around;gap:18px;width:100%}.rp-bubble-wrap{display:flex;flex:1 1 0;flex-direction:column;align-items:center;gap:8px;min-width:0}.rp-bubble{display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;border:1px solid transparent;border-radius:50%;color:#080A12;font-family:"Cormorant Garamond",serif;font-weight:700;line-height:1;flex:0 0 auto}.rp-bubble.r1{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#F5DA72,#D4AF37);box-shadow:0 0 30px rgba(212,175,55,.45);font-size:28px}.rp-bubble.r2{width:54px;height:54px;border-radius:50%;background:rgba(212,175,55,.48);color:#fff;font-size:24px}.rp-bubble.r3{width:46px;height:46px;border-radius:50%;background:rgba(212,175,55,.28);color:rgba(255,255,255,.8);font-size:20px}.rp-bubble.r4{width:40px;height:40px;border-radius:50%;border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.15);color:#fff;font-size:18px}.rp-bubble.r5{width:36px;height:36px;border-radius:50%;border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:rgba(255,255,255,.78);font-size:16px}.rp-bubble-name{max-width:80px;color:#fff;font-size:11px;font-weight:700;line-height:1.25;text-align:center;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rp-verdict-bar{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line)}.rp-vstat{padding:18px;text-align:center;border-right:1px solid var(--line)}.rp-vstat:last-child{border-right:0}.rp-vstat-label,.rp-th{color:rgba(255,255,255,.48);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}.rp-vstat-val{font-family:"DM Mono",monospace;font-size:34px;font-weight:700}.rp-vstat-val.grn{color:var(--green)}.rp-vstat-val.orn{color:var(--orange)}.rp-vstat-val.red{color:var(--red)}.rp-vstat-val.muted{color:var(--muted)}
.rp-table-wrap{overflow-x:auto}.rp-table{width:100%;min-width:760px;border-collapse:collapse}.rp-table thead{background:var(--panel2)}.rp-th{padding:12px 14px;text-align:left}.rp-th.r{text-align:right}.rp-tr{border-top:1px solid var(--line)}.rp-tr.sel{background:rgba(212,175,55,.08)}.rp-tr.out{opacity:.42}.rp-td{padding:14px;vertical-align:middle;font-size:12px}.rp-td.r{text-align:right}.rp-num{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;border:1px solid var(--line);color:rgba(255,255,255,.7);font-family:"DM Mono",monospace;font-weight:700}.rp-num.sel{border-color:var(--gold);background:rgba(212,175,55,.18);color:var(--gold)}.rp-horse{font-family:"Cormorant Garamond",serif;font-size:20px;font-weight:700;color:#fff;white-space:nowrap}.rp-sub,.rp-mise.none{color:rgba(255,255,255,.52);font-size:11px}.rp-score-cell{display:flex;justify-content:flex-end;align-items:center;gap:10px}.rp-score-track{width:56px;height:4px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden}.rp-score-fill{height:100%;background:var(--gold)}.rp-score-fill.lo{background:var(--orange)}.rp-score-num{color:var(--gold);font-weight:700}.rp-score-num.lo{color:var(--orange)}.rp-cote{color:var(--blue);font-weight:700}.rp-mise{color:#fff;font-weight:700}
.rp-sbody{display:grid;gap:12px;padding:16px}.rp-vbet{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid rgba(0,200,81,.3);border-left:3px solid var(--green);border-radius:8px;background:rgba(0,200,81,.08);padding:12px}.rp-vbet-name{font-family:"Cormorant Garamond",serif;font-size:18px;font-weight:700}.rp-vbet-edge{color:var(--green);font-size:24px;font-weight:700}.rp-pro-lock{border:1px solid rgba(212,175,55,.35);border-radius:8px;background:rgba(212,175,55,.08);padding:14px;text-align:center}.rp-pro-lock p{color:var(--gold);font-size:12px}.rp-pro-link{display:inline-flex;margin-top:10px;border-radius:8px;background:var(--gold);color:#080A12;font-size:11px;font-weight:700;letter-spacing:.1em;padding:10px 16px;text-decoration:none;text-transform:uppercase}.rp-alert-btn{padding:16px}.rp-alert-btn button{border-radius:8px!important}.rp-plan-row{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding:10px 0;font-size:12px}.rp-plan-row:last-child{border-bottom:0}.rp-plan-lbl{color:rgba(255,255,255,.5)}.rp-plan-val{color:#fff;font-weight:700;text-align:right}
@media(max-width:768px){.rp-nav{grid-template-columns:auto auto 1fr auto;padding:12px 16px}.rp-logo{font-size:23px}.rp-links{display:none}.rp-burger{display:inline-flex}.rp-body{padding:16px}.rp-course-header{padding:16px;display:grid}.rp-course-name{font-size:28px}.rp-page-grid{grid-template-columns:1fr}.rp-sidebar{grid-row:auto}.rp-verdict-bar{grid-template-columns:1fr}.rp-table-wrap{overflow-x:auto}.rp-official{padding:18px 16px}.rp-arrival-list,.rp-bubbles{justify-content:flex-start;overflow-x:auto;padding-bottom:4px}.rp-sel-body{padding:18px 16px}.rp-bubble-wrap{flex:0 0 82px}.rp-bubble.r1{width:64px;height:64px;font-size:28px}.rp-bubble.r2{width:54px;height:54px;font-size:24px}.rp-bubble.r3{width:46px;height:46px;font-size:20px}.rp-bubble.r4{width:40px;height:40px;font-size:18px}.rp-bubble.r5{width:36px;height:36px;font-size:16px}}
`;

export default async function RacePage({ params, searchParams }: RacePageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const today = getTodayDateStr();
  const requestedDate = normalizeRequestedDate(getSearchDate(resolvedSearchParams.date), today);

  if (!requestedDate) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--pmu-bg)] px-4 text-[var(--pmu-text)]">
        <style>{CSS}</style>
        <section className="app-card max-w-xl p-6 text-center">
          <p className="app-kicker">Date invalide</p>
          <h1 className="mt-2 font-heading text-4xl font-black text-[var(--pmu-text)]">Impossible de charger cette course.</h1>
          <Link className="app-button-primary mt-5 inline-flex" href="/dashboard">
            Revenir au dashboard
          </Link>
        </section>
      </main>
    );
  }

  const state = await loadRacePageData(id, requestedDate);

  if (state.kind !== "ready") {
    const title = state.kind === "invalid" ? "Identifiant invalide" : state.kind === "not-found" ? "Course introuvable" : "Analyse indisponible";
    const detail = state.kind === "not-found" ? `Aucune course pour le ${state.date}.` : "Les donnÃ©es PMU se mettent Ã  jour.";
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--pmu-bg)] px-4 text-[var(--pmu-text)]">
        <style>{CSS}</style>
        <section className="app-card max-w-xl p-6 text-center">
          <p className="app-kicker">PMU Gagnant</p>
          <h1 className="mt-2 font-heading text-4xl font-black text-[var(--pmu-text)]">{title}</h1>
          <p className="mt-3 text-sm text-[var(--pmu-muted)]">{detail}</p>
          <Link className="app-button-primary mt-5 inline-flex" href="/dashboard">
            Revenir au dashboard
          </Link>
        </section>
      </main>
    );
  }

  const { courseInfo, analysis, rows, arrivee, cotesLive } = state;
  const selectedRow = getRecommendedRow(rows, analysis);
  const selectedNumber = selectedRow?.numero ?? null;
  const minutesUntilStart = getMinutesUntilStart(courseInfo.heureDepart, courseInfo.dateStr);
  const status = getVmaxRaceStatus(null, minutesUntilStart);
  const gaugeScore = getGaugeScore(analysis, selectedRow);
  const verdict = selectedRow
    ? computeRaceVerdict({ numero: selectedRow.numero, cheval: selectedRow.cheval, cote: selectedRow.cote, score: selectedRow.scoreV10 ?? selectedRow.scoreIa })
    : computeRaceVerdict({ numero: 0, cheval: "Selection indisponible", cote: null, score: 0 });
  const stakeLabel = selectedRow ? formatStakeEuro(selectedRow.mise) : "--";
  const verdictStakeLabel = verdict.stake > 0 ? formatStakeEuro(verdict.stake) : stakeLabel;
  const verdictToneClass =
    verdict.verdict === "JOUER" ? "grn" : verdict.verdict === "SURVEILLER" ? "orn" : "red";
  const chatRaceId = formatRaceAnalysisId(courseInfo.reunion, courseInfo.course);
  const chatRaceDate = toIsoDate(courseInfo.dateStr);
  const [alertCount, initialChatMessages] = await Promise.all([
    countRaceAlerts(courseInfo.dateStr, courseInfo.reunion, courseInfo.course),
    loadInitialRaceChatMessages(chatRaceId, chatRaceDate),
  ]);
  const valueBets = buildValueBets(rows.map((row) => ({ numero: row.numero, cheval: row.cheval, cote: row.cote, scoreIa: row.scoreIa, raison: row.topFacteur })));
  const top5Selection = [...rows]
    .filter((row) => row.scoreIa !== null)
    .sort((left, right) => (right.scoreV10 ?? right.scoreIa ?? 0) - (left.scoreV10 ?? left.scoreIa ?? 0))
    .slice(0, 5);
  const selectionNumbers = new Set(top5Selection.map((row) => row.numero));
  const statusClass = status === "live" ? "live" : status === "finished" ? "termine" : "upcoming";
  const statusLabel = status === "live" ? "EN COURS" : status === "finished" ? "TERMINE" : "A VENIR";
  const arrivalTop5 = arrivee?.slice(0, 5) ?? [];
  const arrivalRows = arrivalTop5.map((numero) => ({
    numero,
    cheval: rows.find((row) => row.numero === numero)?.cheval ?? `Cheval ${numero}`,
    selectedByIa: selectionNumbers.has(numero),
  }));
  const arrivalBubbleClasses = ["gold", "silver", "bronze", "fourth", "fifth"];
  const selectionBubbleClasses = ["r1", "r2", "r3", "r4", "r5"];
  const navItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Value Bets", href: "/value-bets" },
    { label: "Stats", href: "/stats" },
    { label: "Mon compte", href: "/mes-paris" },
  ];

  return (
    <main className="rp-wrap">
      <style>{CSS}</style>
      <header className="rp-nav">
        <Link href="/dashboard" className="rp-logo">PMU GAGNANT</Link>
        <span className="rp-live">LIVE</span>
        <nav className="rp-links" aria-label="Navigation principale">
          {navItems.map((item) => (
            <Link href={item.href} key={item.label}>{item.label}</Link>
          ))}
        </nav>
        <button className="rp-burger" type="button" aria-label="Menu">?</button>
        <DashboardHeaderAccount />
      </header>

      <div className="rp-body">
        <section className="rp-course-header">
          <div>
            <h1 className="rp-course-name">{courseInfo.nomCourse}</h1>
            <div className="rp-course-meta">
              <span>{courseInfo.hippodrome}</span>
              <span className="rp-course-meta-dot" />
              <span>{courseInfo.discipline}</span>
              <span className="rp-course-meta-dot" />
              <span>{courseInfo.distance} m</span>
              <span className="rp-course-meta-dot" />
              <span>{courseInfo.nombrePartants} partants</span>
              <span className="rp-course-meta-dot" />
              <span>{courseInfo.heureDepart}</span>
              <span className="rp-course-meta-dot" />
              <span>R{courseInfo.reunion}C{courseInfo.course}</span>
            </div>
          </div>
          <div className="rp-header-right">
            <span className={`rp-course-badge ${statusClass}`}>{statusLabel}</span>
            <ScoreGauge score={gaugeScore} label="confiance IA" />
          </div>
        </section>

        {arrivalRows.length > 0 ? (
          <section className="rp-official">
            <div className="rp-official-title">ARRIVÉE OFFICIELLE</div>
            <div className="rp-arrival-list">
              {arrivalRows.map((row, index) => (
                <div className="rp-arrival-item" key={row.numero}>
                  <div className="rp-arrival-head">
                    <span className="rp-arrival-rank">{index + 1}{index === 0 ? "er" : "eme"}</span>
                    <span className={`rp-arrival-num ${arrivalBubbleClasses[index]}`}>{row.numero}</span>
                  </div>
                  <strong className="rp-arrival-horse">{row.cheval}</strong>
                  <span className={`rp-ai-badge ${row.selectedByIa ? "ok" : "ko"}`}>
                    {row.selectedByIa ? "IA CORRECTE" : "IA INCORRECTE"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rp-card">
          <div className="rp-card-header">Bloc selection IA</div>
          <div className="rp-sel-body">
            <div className="rp-bubbles">
              {top5Selection.map((row, index) => (
                <div key={row.numero} className="rp-bubble-wrap">
                  <div className={`rp-bubble ${selectionBubbleClasses[index]}`}>{row.numero}</div>
                  <div className="rp-bubble-name">{row.cheval}</div>
                </div>
              ))}
              {top5Selection.length === 0 ? <span className="rp-sub">Analyse en cours</span> : null}
            </div>
          </div>
          <div className="rp-verdict-bar">
            <div className="rp-vstat">
              <div className="rp-vstat-label">Verdict</div>
              <div className={`rp-vstat-val ${verdictToneClass}`}>{verdict.verdict}</div>
            </div>
            <div className="rp-vstat">
              <div className="rp-vstat-label">Confiance</div>
              <div className="rp-vstat-val">{verdict.scorePercent}%</div>
            </div>
            <div className="rp-vstat">
              <div className="rp-vstat-label">Mise Kelly</div>
              <div className="rp-vstat-val">{verdictStakeLabel}</div>
            </div>
          </div>
        </section>

        <div className="rp-page-grid">
          <div className="rp-main">
            <section className="rp-card">
              <div className="rp-card-header">
                <span>Tableau partants</span>
                {cotesLive ? <span className="rp-live-odds">Cotes live</span> : null}
              </div>
              <div className="rp-table-wrap">
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th className="rp-th">N°</th>
                      <th className="rp-th">Cheval</th>
                      <th className="rp-th">Jockey</th>
                      <th className="rp-th r">Score VMAX</th>
                      <th className="rp-th r">Cote</th>
                      <th className="rp-th r">Mise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const active = row.mise !== null && row.mise > 0;
                      const score = row.scoreV10 ?? row.scoreIa;
                      const isSelected = row.numero === selectedNumber;
                      return (
                        <tr key={row.numero} className={`rp-tr ${isSelected ? "sel" : !active && score !== null && score < 50 ? "out" : ""}`}>
                          <td className="rp-td"><div className={`rp-num ${isSelected ? "sel" : ""}`}>{row.numero}</div></td>
                          <td className="rp-td"><div className="rp-horse">{row.cheval}</div></td>
                          <td className="rp-td"><div className="rp-sub">{row.jockey}</div></td>
                          <td className="rp-td r">
                            {score !== null ? (
                              <div className="rp-score-cell">
                                <div className="rp-score-track"><div className={`rp-score-fill ${active ? "" : "lo"}`} style={{ width: `${Math.min(100, score)}%` }} /></div>
                                <div className={`rp-score-num ${active ? "" : "lo"}`}>{Math.round(score)}</div>
                              </div>
                            ) : <span className="rp-sub">--</span>}
                          </td>
                          <td className="rp-td r"><span className="rp-cote">{row.cote ? formatOdds(row.cote) : "--"}</span></td>
                          <td className="rp-td r">{active ? <span className="rp-mise">{formatStakeEuro(row.mise)}</span> : <span className="rp-mise none">pas joue</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="rp-sidebar">
            <section className="rp-scard">
              <div className="rp-stitle">Value Bets</div>
              <div className="rp-sbody">
                {valueBets.length > 0 ? (
                  <>
                    {valueBets.slice(0, 1).map((bet) => (
                      <div key={bet.numero}>
                        <div className="rp-vbet">
                          <div>
                            <div className="rp-vbet-name">#{bet.numero} {bet.cheval}</div>
                            <div className="rp-sub">PMU {formatOdds(bet.coteActuelle)} · fair {formatOdds(bet.coteFair)}</div>
                          </div>
                          <div className="rp-vbet-edge">+{Math.round(bet.edgePct)}%</div>
                        </div>
                        <div className="rp-sub" style={{ marginTop: "8px", lineHeight: 1.5 }}>{getValueExplanation(bet.explanation)}</div>
                      </div>
                    ))}
                    {valueBets.length > 1 ? (
                      <div className="rp-pro-lock">
                        <p>{valueBets.length - 1} value bets masques PRO</p>
                        <Link href="/premium" className="rp-pro-link">Passer PRO</Link>
                      </div>
                    ) : null}
                  </>
                ) : <div className="rp-sub">Aucun value bet net. Restez discipline.</div>}
              </div>
            </section>

            <section className="rp-scard">
              <div className="rp-stitle">Alerte Telegram</div>
              <div className="rp-alert-btn">
                <RaceAlertButton
                  dateStr={courseInfo.dateStr}
                  reunion={courseInfo.reunion}
                  course={courseInfo.course}
                  hippodrome={courseInfo.hippodrome}
                  heureDepart={courseInfo.heureDepart}
                  chevalNum={verdict.numero}
                  chevalNom={verdict.cheval}
                />
              </div>
              {alertCount !== null && alertCount > 0 ? <div className="rp-sub" style={{ padding: "0 16px 16px" }}>{alertCount} abonnes suivent ce signal</div> : null}
            </section>

            <section className="rp-scard">
              <div className="rp-stitle">Plan de jeu</div>
              <div className="rp-sbody">
                {analysis?.favori?.prediction.typePariConseille ? (
                  <div className="rp-plan-row"><span className="rp-plan-lbl">Type conseille</span><span className="rp-plan-val">{analysis.favori.prediction.typePariConseille}</span></div>
                ) : null}
                {analysis?.prediction.lisibilite ? (
                  <div className="rp-plan-row"><span className="rp-plan-lbl">Lisibilite</span><span className="rp-plan-val">{analysis.prediction.lisibilite}</span></div>
                ) : null}
                <div className="rp-plan-row"><span className="rp-plan-lbl">Course</span><span className="rp-plan-val">R{courseInfo.reunion}C{courseInfo.course}</span></div>
                <div className="rp-plan-row"><span className="rp-plan-lbl">Cote selection</span><span className="rp-plan-val">{formatOdds(verdict.cote)}</span></div>
              </div>
            </section>
          </aside>
        </div>

        <RaceChat
          raceId={chatRaceId}
          raceDate={chatRaceDate}
          initialMessages={initialChatMessages}
          pinnedVerdict={{ verdict: verdict.verdict, cheval: verdict.cheval, cote: formatOdds(verdict.cote), mise: verdictStakeLabel }}
        />
      </div>
    </main>
  );
}
