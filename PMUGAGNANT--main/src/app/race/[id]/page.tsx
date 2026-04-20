import type { Metadata } from "next";
import Link from "next/link";
import CountdownTimer from "@/components/race/CountdownTimer";
import RaceAlertButton from "@/components/race/RaceAlertButton";
import RaceChat from "@/components/race/RaceChat";
import ScoreGauge from "@/components/ui/ScoreGauge";
import StatusBadge from "@/components/ui/StatusBadge";
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
import { getAllRaces, getParticipants } from "@/lib/pmu-api";
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
    "Analyse IA d'une course PMU : tableau des partants, scores, cotes, forme, mises conseillées et value bets.",
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
      dataBadge: "Supabase" | "Données J-1" | "Live PMU";
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
        jockey: participant.jockey || participant.driver || "—",
        entraineur: participant.entraineur || "—",
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
      jockey: "—",
      entraineur: "—",
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
  return value ?? "L'IA détecte un écart positif entre le prix PMU et la probabilité estimée.";
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
        return { kind: "ready", courseInfo: fallback.courseInfo, analysis: null, rows: fallback.rows, dataBadge: "Données J-1" };
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
        return { kind: "ready", courseInfo: fallback.courseInfo, analysis: null, rows: fallback.rows, dataBadge: "Données J-1" };
      }
    }
    const participants = await attachFaultRates(await getParticipants(requestedDate, parsed.reunion, parsed.course));
    const analysis = participants.length > 0 ? analyzeRaceWithParameters(courseInfo, participants, algoParameters) : null;
    const rows = buildParticipantRows(participants, analysis?.ranking ?? [], storedRows, scoreSnapshots);
    return { kind: "ready", courseInfo, analysis, rows, dataBadge: storedRows.length > 0 || scoreSnapshots.length > 0 ? "Supabase" : "Live PMU" };
  } catch (error) {
    logger.error("race_page.load_failed", error, { id, requestedDate });
    const fallback = await loadLatestStoredRaceFallback(excluded).catch(() => null);
    if (fallback?.courseInfo && fallback.rows.length > 0) {
      return { kind: "ready", courseInfo: fallback.courseInfo, analysis: null, rows: fallback.rows, dataBadge: "Données J-1" };
    }
    return { kind: "error" };
  }
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Cormorant+Garamond:ital,wght@0,300;0,600;0,700;1,400&display=swap');
.rp-wrap{--bg:#07080F;--s1:#0D1020;--s2:#131628;--g:#D4AF37;--g2:#FFE566;--g3:#8B6914;--txt:#FFFFFF;--txt2:#6A6A80;--txt3:#3A3A50;--grn:#00FF87;--red:#FF4D5A;--blu:#4DC8FF;--bdr:rgba(212,175,55,0.15);--bdr2:rgba(212,175,55,0.35);font-family:"DM Mono",monospace;color:var(--txt);background:var(--bg);min-height:100vh}
.rp-topbar{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:12px 32px;background:rgba(7,8,15,0.92);border-bottom:1px solid var(--bdr);backdrop-filter:blur(20px)}
.rp-logo{font-family:"Cormorant Garamond",serif;font-size:22px;font-weight:700;background:linear-gradient(90deg,#D4AF37,#FFE566);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-decoration:none;letter-spacing:2px;text-transform:uppercase}
.rp-data-badge{font-size:9px;background:rgba(255,255,255,0.04);border:1px solid var(--bdr);border-radius:20px;padding:3px 10px;color:var(--txt2);letter-spacing:0.5px}
.rp-body{max-width:1280px;margin:0 auto;padding:24px;display:grid;gap:20px}
.rp-course-header{position:relative;overflow:hidden;border-radius:20px;padding:32px 36px;border:1px solid var(--bdr2);background:linear-gradient(135deg,#0D1020 0%,#131628 60%,#0A0D1C 100%);display:flex;align-items:flex-start;justify-content:space-between;gap:24px;flex-wrap:wrap}
.rp-course-header::before{content:"";position:absolute;top:-80px;right:-80px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(212,175,55,0.1) 0%,transparent 65%);pointer-events:none}
.rp-course-tag{font-size:10px;color:var(--g);letter-spacing:3px;text-transform:uppercase;margin-bottom:10px}
.rp-course-name{font-family:"Cormorant Garamond",serif;font-size:44px;font-weight:700;color:#fff;line-height:1;letter-spacing:-1px;margin-bottom:14px}
.rp-course-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--txt2)}
.rp-sep{color:var(--txt3)}
.rp-header-right{display:flex;flex-direction:column;align-items:flex-end;gap:14px;min-width:120px}
.rp-badge,.rp-course-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;letter-spacing:1.5px;padding:6px 16px;border-radius:20px}
.rp-badge.live,.rp-course-badge.live{background:rgba(0,255,135,0.1);border:1px solid rgba(0,255,135,0.4);color:var(--grn)}
.rp-badge.termine,.rp-course-badge.termine{background:rgba(77,200,255,0.1);border:1px solid rgba(77,200,255,0.3);color:var(--blu)}
.rp-badge.upcoming,.rp-course-badge.upcoming{background:rgba(212,175,55,0.1);border:1px solid var(--bdr2);color:var(--g)}
.rp-live-dot{width:7px;height:7px;border-radius:50%;background:var(--grn);box-shadow:0 0 10px var(--grn);animation:rpblink 1.4s infinite}
@keyframes rpblink{0%,100%{opacity:1}50%{opacity:0.3}}
.rp-grid{display:grid;grid-template-columns:1fr 290px;gap:20px;align-items:start}
@media(max-width:900px){.rp-grid{grid-template-columns:1fr}}
.rp-main{display:grid;gap:20px}
.rp-card{background:var(--s1);border:1px solid var(--bdr);border-radius:20px;overflow:hidden}
.rp-card-header{padding:14px 24px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between}
.rp-card-title{font-size:9px;color:var(--g);text-transform:uppercase;letter-spacing:3px}
.rp-sel-body{padding:24px 28px}
.rp-bubbles{display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap}
.rp-bubble-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;min-width:80px}
.rp-bubble{width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:"Cormorant Garamond",serif;font-size:34px;font-weight:700;line-height:1;flex-shrink:0}
.rp-bubble.r1{background:linear-gradient(135deg,#D4AF37,#FFE566);color:#07080F;box-shadow:0 0 32px rgba(212,175,55,0.5),0 0 64px rgba(212,175,55,0.15)}
.rp-bubble.r2{background:linear-gradient(135deg,rgba(212,175,55,0.45),rgba(212,175,55,0.65));color:#fff;border:1px solid rgba(212,175,55,0.5);box-shadow:0 0 16px rgba(212,175,55,0.2)}
.rp-bubble.r3{background:rgba(212,175,55,0.1);color:rgba(212,175,55,0.6);border:1px solid rgba(212,175,55,0.2)}
.rp-bubble-name{font-size:11px;color:var(--txt);text-align:center;max-width:80px;line-height:1.3}
.rp-bubble-score{font-size:10px;color:var(--txt2);text-align:center}
.rp-verdict-bar{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--bdr)}
.rp-vstat{text-align:center;padding:20px 12px;border-right:1px solid var(--bdr)}
.rp-vstat:last-child{border-right:none}
.rp-vstat-label{font-size:9px;color:var(--txt2);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px}
.rp-vstat-val{font-family:"Cormorant Garamond",serif;font-size:40px;font-weight:700;line-height:1}
.rp-vstat-val.gold{background:linear-gradient(90deg,#D4AF37,#FFE566);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.rp-vstat-val.grn{background:linear-gradient(90deg,#00FF87,#00C851);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.rp-vstat-val.orn{color:#FF9F1C}
.rp-vstat-val.red{color:var(--red)}
.rp-vstat-val.muted{color:var(--txt2)}
.rp-table-wrap{overflow-x:auto}
.rp-table{width:100%;border-collapse:collapse;min-width:640px}
.rp-th{font-size:9px;color:var(--g);text-transform:uppercase;letter-spacing:2px;padding:12px 16px;text-align:left;border-bottom:1px solid var(--bdr);white-space:nowrap;background:rgba(212,175,55,0.03)}
.rp-th.r{text-align:right}
.rp-tr{border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.12s;cursor:pointer}
.rp-tr:last-child{border-bottom:none}
.rp-tr:hover{background:rgba(212,175,55,0.04)}
.rp-tr.sel{background:linear-gradient(90deg,rgba(212,175,55,0.08),transparent);border-left:3px solid var(--g)}
.rp-tr.out{opacity:0.28}
.rp-td{padding:14px 16px;vertical-align:middle}
.rp-td.r{text-align:right}
.rp-num{font-family:"Cormorant Garamond",serif;font-size:22px;font-weight:300;color:var(--txt2);line-height:1;text-align:center}
.rp-num.sel{background:linear-gradient(135deg,#D4AF37,#FFE566);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700;font-size:26px}
.rp-horse{font-size:13px;color:#fff;letter-spacing:0.2px;white-space:nowrap}
.rp-sub{font-size:10px;color:var(--txt2);margin-top:3px;white-space:nowrap}
.rp-score-cell{display:flex;align-items:center;gap:10px;justify-content:flex-end}
.rp-score-track{height:3px;background:rgba(255,255,255,0.06);border-radius:2px;width:50px;overflow:hidden}
.rp-score-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,#8B6914,#D4AF37)}
.rp-score-fill.lo{background:rgba(255,255,255,0.12)}
.rp-score-n{font-family:"Cormorant Garamond",serif;font-size:22px;font-weight:700;background:linear-gradient(90deg,#D4AF37,#FFE566);-webkit-background-clip:text;-webkit-text-fill-color:transparent;min-width:32px;text-align:right}
.rp-score-n.lo{background:none;-webkit-text-fill-color:var(--txt2);font-weight:300}
.rp-musique{font-size:10px;color:var(--txt2);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rp-cote{font-size:13px;color:var(--txt2)}
.rp-mise{font-family:"Cormorant Garamond",serif;font-size:22px;font-weight:600;color:#fff}
.rp-mise.none{color:var(--txt2);font-size:11px;font-family:"DM Mono",monospace;font-weight:300}
.rp-sidebar{display:grid;gap:16px}
.rp-scard{background:var(--s1);border:1px solid var(--bdr);border-radius:20px;overflow:hidden}
.rp-stitle{font-size:9px;color:var(--g);text-transform:uppercase;letter-spacing:3px;padding:14px 20px;border-bottom:1px solid var(--bdr)}
.rp-sbody{padding:16px 20px;display:grid;gap:10px}
.rp-vbet{padding:12px 14px;border-radius:12px;background:rgba(0,255,135,0.05);border:1px solid rgba(0,255,135,0.2);border-left:3px solid var(--grn);display:flex;justify-content:space-between;align-items:center}
.rp-vbet-name{font-size:12px;color:#fff}
.rp-vbet-sub{font-size:10px;color:var(--txt2);margin-top:3px}
.rp-vbet-edge{font-family:"Cormorant Garamond",serif;font-size:26px;font-weight:700;background:linear-gradient(90deg,#00FF87,#00C851);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.rp-plan-row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--bdr);font-size:12px}
.rp-plan-row:last-child{border-bottom:none}
.rp-plan-lbl{color:var(--txt2)}
.rp-plan-val{color:#fff}
.rp-raison{background:var(--s2);border-radius:10px;padding:12px 14px;font-size:12px;color:var(--txt2);line-height:1.6;border-left:2px solid rgba(212,175,55,0.3)}
.rp-alert-btn{margin:12px 20px 16px}
.rp-pro-lock{background:linear-gradient(135deg,rgba(212,175,55,0.08),rgba(212,175,55,0.03));border:1px solid var(--bdr2);border-radius:12px;padding:16px;text-align:center}
.rp-pro-lock p{font-size:12px;color:var(--g);margin-bottom:12px}
.rp-pro-link{display:inline-flex;background:linear-gradient(90deg,#D4AF37,#FFE566);color:#07080F;font-size:11px;font-family:"DM Mono",monospace;padding:9px 20px;border-radius:8px;text-decoration:none;font-weight:500}
@media(max-width:640px){.rp-course-name{font-size:28px}.rp-bubble{width:56px;height:56px;font-size:26px}.rp-verdict-bar{grid-template-columns:1fr}.rp-grid{grid-template-columns:1fr}}

/* Light app skin: keep the race logic, remove the old VMAX dark page. */
.rp-wrap{--bg:var(--pmu-bg,#F8F6EF);--s1:var(--pmu-surface,#FFFFFF);--s2:var(--pmu-surface-2,#F1EEE3);--g:var(--pmu-accent,#D6B633);--g2:var(--pmu-accent,#D6B633);--g3:#A38719;--txt:var(--pmu-text,#162318);--txt2:var(--pmu-muted,#67706A);--txt3:#8B938D;--grn:var(--pmu-primary,#006837);--red:#C94B57;--blu:#2777AD;--bdr:var(--pmu-border,#DDD8C9);--bdr2:rgba(0,104,55,0.22);font-family:var(--font-ui),Arial,sans-serif;color:var(--txt);background:var(--bg);min-height:100vh}
.rp-topbar{position:sticky;top:0;z-index:50;background:rgba(255,255,255,0.9);border-bottom:1px solid var(--bdr);box-shadow:0 10px 30px rgba(29,41,31,0.06);backdrop-filter:blur(16px)}
.rp-logo{font-family:var(--font-heading),Arial,sans-serif;font-size:20px;font-weight:900;color:var(--pmu-primary,#006837);background:none;-webkit-text-fill-color:currentColor;text-decoration:none;letter-spacing:.08em;text-transform:uppercase}
.rp-data-badge{background:var(--s2);border:1px solid var(--bdr);color:var(--txt2);font-weight:800}
.rp-body{max-width:96rem;margin:0 auto;padding:24px 18px 72px}
.rp-course-header{background:var(--s1);border:1px solid var(--bdr);border-radius:8px;box-shadow:0 18px 48px rgba(29,41,31,0.08);padding:24px;gap:18px}
.rp-course-name{font-family:var(--font-heading),Arial,sans-serif;color:var(--txt);font-size:clamp(32px,5vw,58px);line-height:1;letter-spacing:0}
.rp-course-meta{color:var(--txt2)}
.rp-course-meta-dot{background:var(--g)}
.rp-course-badge{border-radius:8px;border-color:var(--bdr);background:var(--s2);color:var(--txt)}
.rp-course-badge.live{border-color:rgba(0,104,55,.28);background:rgba(0,104,55,.08);color:var(--pmu-primary,#006837)}
.rp-course-badge.termine{border-color:rgba(103,112,106,.28);background:rgba(103,112,106,.1);color:var(--txt2)}
.rp-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,360px);gap:24px}
.rp-card,.rp-scard{background:var(--s1);border:1px solid var(--bdr);border-radius:8px;box-shadow:0 16px 42px rgba(29,41,31,0.08);overflow:hidden}
.rp-card-header,.rp-stitle{border-bottom:1px solid var(--bdr);background:linear-gradient(180deg,#fff,var(--s2));color:var(--pmu-primary,#006837)}
.rp-card-title,.rp-stitle{font-weight:900;letter-spacing:.16em}
.rp-selection{background:linear-gradient(180deg,#fff,var(--s2));border-bottom:1px solid var(--bdr)}
.rp-bubble{background:var(--s2);border:1px solid var(--bdr);box-shadow:none;color:var(--txt)}
.rp-bubble.sel{background:var(--pmu-accent,#D6B633);border-color:var(--pmu-accent,#D6B633);color:#142015;box-shadow:0 12px 30px rgba(214,182,51,.24)}
.rp-bubble-score,.rp-sub,.rp-musique,.rp-mise.none,.rp-plan-lbl,.rp-raison{color:var(--txt2)}
.rp-bubble-name,.rp-horse,.rp-plan-val,.rp-vbet-name{color:var(--txt)}
.rp-verdict-bar{background:#fff;border-top:1px solid var(--bdr)}
.rp-vstat{border-right:1px solid var(--bdr)}
.rp-vstat-label,.rp-th{color:var(--txt2)}
.rp-vstat-val{font-family:var(--font-heading),Arial,sans-serif;color:var(--txt)}
.rp-vstat-val.grn,.rp-score-num,.rp-mise,.rp-vbet-edge{color:var(--pmu-primary,#006837);background:none;-webkit-text-fill-color:currentColor}
.rp-vstat-val.orn{color:#A87900}
.rp-vstat-val.muted{color:var(--txt2)}
.rp-table-wrap{background:#fff}
.rp-table{background:#fff}
.rp-table thead{background:var(--s2)}
.rp-tr{background:#fff;border-bottom:1px solid var(--bdr);opacity:1}
.rp-tr:hover{background:rgba(0,104,55,.04)}
.rp-tr.sel{background:rgba(214,182,51,.14)}
.rp-tr.out{opacity:.64}
.rp-num{background:var(--s2);color:var(--txt2);border:1px solid var(--bdr)}
.rp-num.sel{background:var(--pmu-primary,#006837);color:#fff;border-color:var(--pmu-primary,#006837)}
.rp-cote{color:var(--txt)}
.rp-score-track{background:#E2DED2}
.rp-score-fill{background:var(--pmu-primary,#006837)}
.rp-score-fill.lo{background:#B8B09D}
.rp-score-num.lo{color:var(--txt2)}
.rp-vbet{background:rgba(0,104,55,.06);border-color:rgba(0,104,55,.18);border-left-color:var(--pmu-primary,#006837)}
.rp-raison{background:var(--s2);border-left-color:var(--pmu-accent,#D6B633)}
.rp-pro-lock{background:var(--s2);border-color:var(--bdr)}
.rp-pro-lock p{color:var(--txt)}
.rp-pro-link{background:var(--pmu-primary,#006837);color:#fff;border-radius:8px}
.rp-alert-btn button{border-radius:8px!important}
@media(max-width:900px){.rp-grid{grid-template-columns:1fr}.rp-body{padding:16px 12px 56px}.rp-course-header{padding:18px}.rp-topbar{padding:12px 16px}}
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
    const detail = state.kind === "not-found" ? `Aucune course pour le ${state.date}.` : "Les données PMU se mettent à jour.";
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

  const { courseInfo, analysis, rows, dataBadge } = state;
  const selectedRow = getRecommendedRow(rows, analysis);
  const selectedNumber = selectedRow?.numero ?? null;
  const minutesUntilStart = getMinutesUntilStart(courseInfo.heureDepart, courseInfo.dateStr);
  const status = getVmaxRaceStatus(null, minutesUntilStart);
  const gaugeScore = getGaugeScore(analysis, selectedRow);
  const verdict = selectedRow
    ? computeRaceVerdict({ numero: selectedRow.numero, cheval: selectedRow.cheval, cote: selectedRow.cote, score: selectedRow.scoreV10 ?? selectedRow.scoreIa })
    : computeRaceVerdict({ numero: 0, cheval: "Sélection indisponible", cote: null, score: 0 });
  const stakeLabel = selectedRow ? formatStakeEuro(selectedRow.mise) : "—";
  const verdictStakeLabel = verdict.stake > 0 ? formatStakeEuro(verdict.stake) : stakeLabel;
  const verdictToneClass =
    verdict.verdict === "JOUER" ? "grn" : verdict.verdict === "SURVEILLER" ? "orn" : "muted";
  const chatRaceId = formatRaceAnalysisId(courseInfo.reunion, courseInfo.course);
  const chatRaceDate = toIsoDate(courseInfo.dateStr);
  const [alertCount, initialChatMessages] = await Promise.all([
    countRaceAlerts(courseInfo.dateStr, courseInfo.reunion, courseInfo.course),
    loadInitialRaceChatMessages(chatRaceId, chatRaceDate),
  ]);
  const valueBets = buildValueBets(rows.map((row) => ({ numero: row.numero, cheval: row.cheval, cote: row.cote, scoreIa: row.scoreIa, raison: row.topFacteur })));
  const topReasons = [
    ...(analysis?.favori?.prediction.topFacteurs ?? []),
    analysis?.prediction.lisibilite ? `Course ${analysis.prediction.lisibilite.toLowerCase()}` : null,
    analysis?.soliditeFavori?.alertes[0] ? `Point de vigilance : ${analysis.soliditeFavori.alertes[0]}` : null,
  ].filter((reason): reason is string => Boolean(reason)).slice(0, 3);
  const urgentRace = minutesUntilStart > 0 && minutesUntilStart < 30;

  // Top 3 par score pour les bulles
  const top3 = [...rows]
    .filter((r) => r.scoreIa !== null)
    .sort((a, b) => (b.scoreV10 ?? b.scoreIa ?? 0) - (a.scoreV10 ?? a.scoreIa ?? 0))
    .slice(0, 3);

  const statusClass = status === "live" ? "live" : status === "finished" ? "termine" : "upcoming";
  const statusLabel = status === "live" ? "LIVE" : status === "finished" ? "TERMINÉE" : "À VENIR";

  return (
    <main className="rp-wrap">
      <style>{CSS}</style>

      {/* TOPBAR */}
      <div className="rp-topbar">
        <Link href="/dashboard" className="rp-logo">PMU GAGNANT</Link>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <span className="rp-data-badge">{dataBadge}</span>
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="rp-body">

        {/* HEADER COURSE */}
        <div className="rp-course-header">
          <div>
            <div className="rp-course-name">{courseInfo.nomCourse}</div>
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
            <span className={`rp-course-badge ${statusClass}`}>
              {status === "live" && <span className="rp-live-dot" />}
              {statusLabel}
            </span>
            <ScoreGauge score={gaugeScore} label="confiance IA" />
          </div>
        </div>

        <div className="rp-grid">
          <div className="rp-main">

            {/* SÉLECTION IA */}
            <div className="rp-card">
              <div className="rp-card-header">
                <span className="rp-card-title">Sélection IA VMAX</span>
                {urgentRace && (
                  <span style={{fontSize:'10px',color:'#C26052',letterSpacing:'1px'}}>
                    ⚠ {Math.max(1, Math.round(minutesUntilStart))} min restantes
                  </span>
                )}
              </div>
              <div className="rp-sel-body">
                <div className="rp-bubbles">
                  {top3.map((row, i) => (
                    <div key={row.numero} className="rp-bubble-wrap">
                      <div className={`rp-bubble ${i === 1 ? 'r2' : i === 2 ? 'r3' : 'r1'}`}>
                        {row.numero}
                      </div>
                      <div className="rp-bubble-name">{row.cheval}</div>
                      <div className="rp-bubble-score">Score {Math.round(row.scoreV10 ?? row.scoreIa ?? 0)}</div>
                      {row.cote && <div className="rp-bubble-score">Cote {formatOdds(row.cote)}</div>}
                    </div>
                  ))}
                  {top3.length === 0 && (
                    <span style={{fontSize:'12px',color:'#6A6258'}}>Analyse en cours…</span>
                  )}
                </div>
              </div>
              <div className="rp-verdict-bar">
                <div className="rp-vstat">
                  <div className="rp-vstat-label">Verdict</div>
                  <div className={`rp-vstat-val ${verdictToneClass}`}>
                    {verdict.verdict}
                  </div>
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
            </div>

            {/* TABLEAU DES PARTANTS */}
            <div className="rp-card">
              <div className="rp-card-header">
                <span className="rp-card-title">Tableau des partants</span>
                <span style={{fontSize:'11px',color:'#6A6258'}}>{rows.length} chevaux</span>
              </div>
              <div className="rp-table-wrap">
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th className="rp-th" style={{width:'40px'}}>N°</th>
                      <th className="rp-th">Cheval</th>
                      <th className="rp-th">Jockey / Entraîneur</th>
                      <th className="rp-th">Musique</th>
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
                        <tr key={row.numero} className={`rp-tr ${isSelected ? 'sel' : !active && score !== null && score < 50 ? 'out' : ''}`}>
                          <td className="rp-td">
                            <div className={`rp-num ${isSelected ? 'sel' : ''}`}>{row.numero}</div>
                          </td>
                          <td className="rp-td">
                            <div className="rp-horse">{row.cheval}</div>
                          </td>
                          <td className="rp-td">
                            <div className="rp-sub">{row.jockey}</div>
                            <div className="rp-sub">{row.entraineur}</div>
                          </td>
                          <td className="rp-td">
                            <div className="rp-musique">{row.musique ?? '—'}</div>
                          </td>
                          <td className="rp-td r">
                            {score !== null ? (
                              <div className="rp-score-cell" style={{justifyContent:'flex-end'}}>
                                <div className="rp-score-track">
                                  <div className={`rp-score-fill ${active ? '' : 'lo'}`} style={{width:`${Math.min(100,score)}%`}} />
                                </div>
                                <div className={`rp-score-num ${active ? '' : 'lo'}`}>{Math.round(score)}</div>
                              </div>
                            ) : <span style={{color:'#6A6258',fontSize:'12px'}}>—</span>}
                          </td>
                          <td className="rp-td r">
                            <span className="rp-cote">{row.cote ? formatOdds(row.cote) : '—'}</span>
                          </td>
                          <td className="rp-td r">
                            {active
                              ? <span className="rp-mise">{formatStakeEuro(row.mise)}</span>
                              : <span className="rp-mise none">pas joué</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* POURQUOI CE CHEVAL */}
            {topReasons.length > 0 && (
              <div className="rp-card">
                <div className="rp-card-header">
                  <span className="rp-card-title">Pourquoi ce cheval ?</span>
                </div>
                <div style={{padding:'16px 20px'}} className="rp-raisons">
                  {topReasons.map((reason) => (
                    <div className="rp-raison" key={reason}>{reason}</div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* SIDEBAR */}
          <div className="rp-sidebar">

            {/* COUNTDOWN */}
            <div className="rp-scard">
              <div className="rp-stitle">Départ</div>
              <div style={{padding:'16px 18px'}}>
                <CountdownTimer dateStr={courseInfo.dateStr} heureDepart={courseInfo.heureDepart} variant="hero" />
              </div>
            </div>

            {/* ALERTE */}
            <div className="rp-scard">
              <div className="rp-stitle">Alerte Telegram</div>
              <div className="rp-alert-btn" style={{marginTop:'12px'}}>
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
              {alertCount !== null && alertCount > 0 && (
                <div style={{padding:'0 18px 14px',fontSize:'11px',color:'#6A6258'}}>
                  {alertCount} abonnés suivent ce signal
                </div>
              )}
            </div>

            {/* VALUE BETS */}
            <div className="rp-scard">
              <div className="rp-stitle">Value Bets</div>
              <div className="rp-sbody">
                {valueBets.length > 0 ? (
                  <>
                    {valueBets.slice(0, 1).map((bet) => (
                      <div key={bet.numero}>
                        <div className="rp-vbet">
                          <div>
                            <div className="rp-vbet-name">#{bet.numero} {bet.cheval}</div>
                            <div style={{fontSize:'10px',color:'#6A6258',marginTop:'2px'}}>
                              PMU {formatOdds(bet.coteActuelle)} · fair {formatOdds(bet.coteFair)}
                            </div>
                          </div>
                          <div className="rp-vbet-edge">+{Math.round(bet.edgePct)}%</div>
                        </div>
                        <div style={{fontSize:'11px',color:'#6A6258',marginTop:'8px',lineHeight:'1.5'}}>
                          {getValueExplanation(bet.explanation)}
                        </div>
                      </div>
                    ))}
                    {valueBets.length > 1 && (
                      <div className="rp-pro-lock">
                        <p>{valueBets.length - 1} value bets masqués PRO</p>
                        <Link href="/premium" className="rp-pro-link">Passer PRO</Link>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{fontSize:'12px',color:'#6A6258'}}>Aucun value bet net. Restez discipliné.</div>
                )}
              </div>
            </div>

            {/* PLAN DE JEU */}
            <div className="rp-scard">
              <div className="rp-stitle">Plan de jeu</div>
              <div className="rp-sbody">
                {analysis?.favori?.prediction.typePariConseille && (
                  <div className="rp-plan-row">
                    <span className="rp-plan-lbl">Type conseillé</span>
                    <span className="rp-plan-val">{analysis.favori.prediction.typePariConseille}</span>
                  </div>
                )}
                {analysis?.prediction.lisibilite && (
                  <div className="rp-plan-row">
                    <span className="rp-plan-lbl">Lisibilité</span>
                    <span className="rp-plan-val">{analysis.prediction.lisibilite}</span>
                  </div>
                )}
                <div className="rp-plan-row">
                  <span className="rp-plan-lbl">Course</span>
                  <span className="rp-plan-val">R{courseInfo.reunion}C{courseInfo.course}</span>
                </div>
                <div className="rp-plan-row" style={{borderBottom:'none'}}>
                  <span className="rp-plan-lbl">Cote sélection</span>
                  <span className="rp-plan-val">{formatOdds(verdict.cote)}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* CHAT */}
        <RaceChat
          raceId={chatRaceId}
          raceDate={chatRaceDate}
          initialMessages={initialChatMessages}
          pinnedVerdict={{
            verdict: verdict.verdict,
            cheval: verdict.cheval,
            cote: formatOdds(verdict.cote),
            mise: verdictStakeLabel,
          }}
        />

      </div>
    </main>
  );
}
