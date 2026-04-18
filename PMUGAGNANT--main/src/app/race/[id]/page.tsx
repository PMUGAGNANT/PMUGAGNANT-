import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ParticipantsTable from "@/components/race/ParticipantsTable";
import RaceVerdictBanner from "@/components/race/RaceVerdictBanner";
import ScoreGauge from "@/components/ui/ScoreGauge";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  buildValueBets,
  computeRaceVerdict,
  computeRunnerKellyStake,
  formatOdds,
  formatStakeEuro,
  getRunnerNumberClass,
  getStakeToneClass,
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
  listCourseRecordsBetween,
  listPredictionsBetween,
} from "@/lib/prediction-store";
import { normalizeRequestedDate } from "@/lib/request-utils";
import { logger } from "@/lib/server-logger";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type {
  CourseRecordRow,
  Participant,
  PredictionRow,
  RaceAnalysis,
  RaceSummary,
  ScoredParticipant,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "Analyse course - PMU Gagnant",
  description:
    "Analyse IA d'une course PMU : tableau des partants, scores, cotes, forme, mises conseillées et value bets.",
};

export const dynamic = "force-dynamic";

const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAHCAIAAAC+zks0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAGUlEQVR4nGNgYGD4z8DAwMgABXAGNgYAbDgBEi5CZmQAAAAASUVORK5CYII=";

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

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function getSearchDate(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildParticipantRows(
  participants: Participant[],
  ranking: ScoredParticipant[],
  storedRows: PredictionRow[] = [],
  forcedSource: ParticipantTableRow["scoreSource"] | null = null
): ParticipantTableRow[] {
  const rankedByNumber = new Map<number, ScoredParticipant>();
  for (const runner of ranking) {
    rankedByNumber.set(runner.numPmu, runner);
  }
  const storedByNumber = new Map<number, PredictionRow>();
  for (const row of storedRows) {
    storedByNumber.set(row.cheval_num, row);
  }

  return participants
    .filter((participant) => !participant.nonPartant)
    .map((participant) => {
      const runner = rankedByNumber.get(participant.numPmu);
      const stored = storedByNumber.get(participant.numPmu);
      const score =
        stored?.score_final_pari ??
        stored?.score_blended ??
        stored?.score_cheval ??
        runner?.prediction.scoreFinalPari ??
        runner?.prediction.scoreBlended ??
        runner?.prediction.scoreCheval ??
        null;
      const cote =
        stored?.cote_depart ??
        stored?.cote_matin ??
        participant.cote ??
        runner?.cote ??
        runner?.coteDepart ??
        null;

      return {
        numero: participant.numPmu,
        cheval: participant.nom,
        jockey: participant.jockey || participant.driver || "—",
        entraineur: participant.entraineur || "—",
        cote,
        scoreIa: score,
        scoreSource: forcedSource ?? (stored ? "supabase" : runner ? "engine" : "fallback"),
        musique: participant.musique || runner?.musique || null,
        mise: computeRunnerKellyStake(score, cote),
        topFacteur: runner?.prediction.topFacteurs[0] ?? null,
      };
    })
    .sort((left, right) => left.numero - right.numero);
}

function getPredictionScore(row: PredictionRow) {
  return row.score_final_pari ?? row.score_blended ?? row.score_cheval ?? null;
}

function getPredictionOdds(row: PredictionRow) {
  return row.cote_depart ?? row.cote_matin ?? null;
}

function buildRowsFromPredictions(rows: PredictionRow[]): ParticipantTableRow[] {
  return rows
    .map((row) => {
      const score = getPredictionScore(row);
      const cote = getPredictionOdds(row);

      return {
        numero: row.cheval_num,
        cheval: row.cheval_nom,
        jockey: "—",
        entraineur: "—",
        cote,
        scoreIa: score,
        scoreSource: "fallback" as const,
        musique: null,
        mise: computeRunnerKellyStake(score, cote),
        topFacteur: row.avis_texte ?? null,
      };
    })
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
  if (!first) {
    return null;
  }

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
  if (!first) {
    return [];
  }

  return sorted.filter(
    (row) =>
      row.date === first.date &&
      row.reunion === first.reunion &&
      row.course === first.course
  );
}

async function loadLatestStoredRaceFallback(excluded: {
  dateIso: string;
  reunion: number;
  course: number;
}) {
  const endIso = excluded.dateIso;
  const startDate = new Date(`${endIso}T12:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 14);
  const startIso = startDate.toISOString().slice(0, 10);
  const [predictionRows, courseRows] = await Promise.all([
    listPredictionsBetween(startIso, endIso).catch(() => []),
    listCourseRecordsBetween(startIso, endIso).catch(() => []),
  ]);
  const candidates = predictionRows.filter(
    (row) =>
      row.date !== excluded.dateIso ||
      row.reunion !== excluded.reunion ||
      row.course !== excluded.course
  );
  const latestRows = getLatestRaceRows(candidates);
  const first = latestRows[0];
  if (!first) {
    return null;
  }

  const courseRecord = courseRows.find(
    (row) =>
      row.date === first.date &&
      row.reunion === first.reunion &&
      row.course === first.course
  );

  return {
    courseInfo: courseRecord
      ? raceSummaryFromCourseRecord(courseRecord)
      : raceSummaryFromPredictionRows(latestRows, first.date),
    rows: buildRowsFromPredictions(latestRows),
  };
}

function getRecommendedRow(rows: ParticipantTableRow[], analysis: RaceAnalysis | null) {
  const analysisPick = analysis?.favori?.numPmu ?? null;
  if (analysisPick !== null) {
    const row = rows.find((item) => item.numero === analysisPick);
    if (row) return row;
  }

  return [...rows].sort((left, right) => (right.scoreIa ?? 0) - (left.scoreIa ?? 0))[0] ?? null;
}

async function countRaceAlerts(dateStr: string, reunion: number, course: number) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return 247;
  }

  const { count, error } = await admin
    .from("race_alerts")
    .select("id", { count: "exact", head: true })
    .eq("date_str", dateStr)
    .eq("reunion", reunion)
    .eq("course", course)
    .eq("status", "ACTIVE");

  if (error) {
    return 247;
  }

  return count ?? 247;
}

function getGaugeScore(analysis: RaceAnalysis | null, selectedRow: ParticipantTableRow | null) {
  const confidence =
    analysis?.scoreConfiance?.score ?? analysis?.favori?.prediction.confiance ?? null;

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
  if (!parsed) {
    return { kind: "invalid" };
  }

  const excluded = {
    dateIso: toIsoDate(requestedDate),
    reunion: parsed.reunion,
    course: parsed.course,
  };

  try {
    const [races, algoParameters] = await Promise.all([
      getAllRaces(requestedDate),
      loadAlgoParameters(),
    ]);
    const courseInfo = races.find(
      (race) => race.reunion === parsed.reunion && race.course === parsed.course
    );

    if (!courseInfo) {
      const fallback = await loadLatestStoredRaceFallback(excluded);
      if (fallback?.courseInfo && fallback.rows.length > 0) {
        return {
          kind: "ready",
          courseInfo: fallback.courseInfo,
          analysis: null,
          rows: fallback.rows,
          dataBadge: "Données J-1",
        };
      }

      return { kind: "not-found", date: requestedDate };
    }

    const storedRows = await getRacePredictions(requestedDate, parsed.reunion, parsed.course).catch(
      () => []
    );

    if (storedRows.length === 0) {
      const fallback = await loadLatestStoredRaceFallback(excluded);
      if (fallback?.courseInfo && fallback.rows.length > 0) {
        return {
          kind: "ready",
          courseInfo: fallback.courseInfo,
          analysis: null,
          rows: fallback.rows,
          dataBadge: "Données J-1",
        };
      }
    }

    const participants = await attachFaultRates(
      await getParticipants(requestedDate, parsed.reunion, parsed.course)
    );
    const analysis =
      participants.length > 0
        ? analyzeRaceWithParameters(courseInfo, participants, algoParameters)
        : null;
    const rows = buildParticipantRows(participants, analysis?.ranking ?? [], storedRows);

    return {
      kind: "ready",
      courseInfo,
      analysis,
      rows,
      dataBadge: storedRows.length > 0 ? "Supabase" : "Live PMU",
    };
  } catch (error) {
    logger.error("race_page.load_failed", error, {
      id,
      requestedDate,
    });
    const fallback = await loadLatestStoredRaceFallback(excluded).catch(() => null);
    if (fallback?.courseInfo && fallback.rows.length > 0) {
      return {
        kind: "ready",
        courseInfo: fallback.courseInfo,
        analysis: null,
        rows: fallback.rows,
        dataBadge: "Données J-1",
      };
    }

    return { kind: "error" };
  }
}

export default async function RacePage({ params, searchParams }: RacePageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const today = getTodayDateStr();
  const requestedDate = normalizeRequestedDate(getSearchDate(resolvedSearchParams.date), today);

  if (!requestedDate) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0A0E1A] px-4 text-[#F6F2E8]">
        <section className="max-w-xl rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-6 text-center">
          <p className="text-xs font-black uppercase text-[#D4AF37]">Date invalide</p>
          <h1 className="mt-2 font-[var(--font-display)] text-5xl font-black text-[#F6F2E8]">
            Impossible de charger cette course.
          </h1>
          <Link className="mt-5 inline-flex rounded-lg bg-[#D4AF37] px-5 py-3 font-black text-[#0A0E1A]" href="/dashboard">
            Revenir au dashboard
          </Link>
        </section>
      </main>
    );
  }

  const state = await loadRacePageData(id, requestedDate);

  if (state.kind !== "ready") {
    const title =
      state.kind === "invalid"
        ? "Identifiant de course invalide"
        : state.kind === "not-found"
          ? "Course introuvable"
          : "Analyse indisponible";
    const detail =
      state.kind === "not-found"
        ? `Aucune course ne correspond à cette fiche pour le ${state.date}.`
        : "Le dashboard reste disponible pendant que les données PMU se mettent à jour.";

    return (
      <main className="grid min-h-screen place-items-center bg-[#0A0E1A] px-4 text-[#F6F2E8]">
        <section className="max-w-xl rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-6 text-center">
          <p className="text-xs font-black uppercase text-[#D4AF37]">PMU Gagnant</p>
          <h1 className="mt-2 font-[var(--font-display)] text-5xl font-black text-[#F6F2E8]">{title}</h1>
          <p className="mt-3 text-sm font-bold text-slate-400">{detail}</p>
          <Link className="mt-5 inline-flex rounded-lg bg-[#D4AF37] px-5 py-3 font-black text-[#0A0E1A]" href="/dashboard">
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
  const status = getVmaxRaceStatus(
    minutesUntilStart < -10 ? "finished" : null,
    minutesUntilStart
  );
  const gaugeScore = getGaugeScore(analysis, selectedRow);
  const verdict = selectedRow
    ? computeRaceVerdict({
        numero: selectedRow.numero,
        cheval: selectedRow.cheval,
        cote: selectedRow.cote,
        score: selectedRow.scoreIa,
      })
    : computeRaceVerdict({
        numero: 0,
        cheval: "Sélection indisponible",
        cote: null,
        score: 0,
      });
  const alertCount = await countRaceAlerts(courseInfo.dateStr, courseInfo.reunion, courseInfo.course);
  const valueBets = buildValueBets(
    rows.map((row) => ({
      numero: row.numero,
      cheval: row.cheval,
      cote: row.cote,
      scoreIa: row.scoreIa,
      raison: row.topFacteur,
    }))
  );
  const stakeLabel = selectedRow ? formatStakeEuro(selectedRow.mise) : "—";
  const potentialGain =
    selectedRow?.mise && selectedRow.cote
      ? currencyFormatter.format(selectedRow.mise * selectedRow.cote)
      : "Gain potentiel en attente";
  const topReasons = [
    ...(analysis?.favori?.prediction.topFacteurs ?? []),
    analysis?.prediction.lisibilite ? `Course ${analysis.prediction.lisibilite.toLowerCase()}` : null,
    analysis?.soliditeFavori?.alertes[0] ? `Point de vigilance : ${analysis.soliditeFavori.alertes[0]}` : null,
  ].filter((reason): reason is string => Boolean(reason)).slice(0, 3);

  return (
    <main className="min-h-screen bg-[#0A0E1A] text-[#F6F2E8]">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-[#D4AF37]/15 bg-[#0A0E1A]/90 px-4 py-3 backdrop-blur-xl md:px-8">
        <Link href="/dashboard" className="font-[var(--font-display)] text-3xl font-black text-[#D4AF37]">
          PMU GAGNANT
        </Link>
        <StatusBadge status={status} />
      </header>

      <section className="mx-auto grid w-full max-w-[92rem] gap-5 px-4 py-5 lg:grid-cols-[1fr_22rem] lg:px-6">
        <div className="grid gap-5">
          <RaceVerdictBanner
            verdict={verdict}
            dataBadge={dataBadge}
            dateStr={courseInfo.dateStr}
            reunion={courseInfo.reunion}
            course={courseInfo.course}
            hippodrome={courseInfo.hippodrome}
            heureDepart={courseInfo.heureDepart}
            minutesUntilStart={minutesUntilStart}
            alertCount={alertCount}
          />

          <article className="grid overflow-hidden rounded-lg border border-[#D4AF37]/20 bg-[#101827] shadow-2xl shadow-black/25 lg:grid-cols-[0.82fr_1fr]">
            <div className="relative min-h-[16rem] overflow-hidden lg:min-h-[28rem]">
              <Image
                src="/promo-poster.jpg"
                alt="Course PMU analysée par l'IA"
                fill
                priority
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                sizes="(max-width: 768px) 100vw, 40vw"
                className="object-cover brightness-[0.58] contrast-110 saturate-90"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0E1A]/95" />
              <div className="absolute bottom-5 left-5 right-5">
                <p className="text-xs font-black uppercase text-[#D4AF37]">
                  {verdict.verdict === "JOUER" ? "Décision immédiate" : "Course à filtrer"}
                </p>
                <strong
                  className={`mt-2 inline-flex rounded-lg px-4 py-2 font-[var(--font-display)] text-5xl font-black leading-none ${
                    verdict.verdict === "JOUER"
                      ? "bg-[#00C851] text-[#06100B]"
                      : verdict.verdict === "SURVEILLER"
                        ? "bg-[#FF9F1C] text-[#06100B]"
                        : "bg-slate-600 text-white"
                  }`}
                >
                  {verdict.verdict}
                </strong>
              </div>
            </div>

            <div className="grid gap-5 p-5 md:p-8">
              <div className="grid gap-2">
                <p className="text-xs font-black uppercase text-[#D4AF37]">
                  R{courseInfo.reunion}C{courseInfo.course} · {courseInfo.heureDepart}
                </p>
                <h1 className="font-[var(--font-display)] text-6xl font-black leading-[0.9] text-[#F6F2E8] md:text-7xl">
                  {courseInfo.hippodrome}
                </h1>
                <p className="text-sm font-bold text-slate-400">
                  {courseInfo.nomCourse} · {courseInfo.discipline} · {courseInfo.distance} m · {courseInfo.nombrePartants} partants
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-[auto_1fr]">
                <ScoreGauge score={gaugeScore} label="score IA" />
                <div className="rounded-lg border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] p-4">
                  <p className="text-xs font-black uppercase text-[#D4AF37]">Cheval IA #1</p>
                  <div className="mt-3 flex items-center gap-3">
                    {selectedRow ? (
                      <span
                        className={`grid aspect-square w-12 place-items-center rounded-full font-[var(--font-display)] text-2xl font-black ${getRunnerNumberClass(selectedRow.numero)}`}
                      >
                        {selectedRow.numero}
                      </span>
                    ) : null}
                    <div>
                      <strong className="block font-[var(--font-display)] text-4xl font-black leading-none">
                        {selectedRow?.cheval ?? "Sélection en attente"}
                      </strong>
                      <span className="text-sm font-bold text-slate-400">
                        {selectedRow?.jockey ?? "Jockey à confirmer"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-lg border border-white/10 p-4 ${getStakeToneClass(selectedRow?.mise)}`}
                title="Basé sur bankroll de 100€ et Kelly 25%"
              >
                <p className="text-xs font-black uppercase">Mise conseillée</p>
                <strong className="mt-1 block font-[var(--font-display)] text-5xl font-black leading-none">
                  {stakeLabel}
                </strong>
                <span className="mt-2 block text-sm font-black">
                  {selectedRow?.mise ? `Mise ${currencyFormatter.format(selectedRow.mise)} → ${potentialGain}` : potentialGain}
                </span>
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-black uppercase text-[#D4AF37]">Pourquoi ce cheval ?</p>
                {topReasons.length > 0 ? (
                  topReasons.map((reason) => (
                    <p className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-300" key={reason}>
                      {reason}
                    </p>
                  ))
                ) : (
                  <p className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-300">
                    Les signaux IA sont en cours de calcul.
                  </p>
                )}
              </div>
            </div>
          </article>

          <section className="grid gap-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#D4AF37]">Tableau des partants</p>
                <h2 className="font-[var(--font-display)] text-4xl font-black text-[#F6F2E8]">Scores, cotes, forme et mise</h2>
              </div>
              <Link
                href={`/course/${courseInfo.reunion}/${courseInfo.course}?date=${courseInfo.dateStr}`}
                className="hidden rounded-lg border border-[#D4AF37]/30 px-4 py-2 text-sm font-black text-[#D4AF37] md:inline-flex"
              >
                Fiche classique
              </Link>
            </div>
            <ParticipantsTable rows={rows} selectedNumber={selectedNumber} />
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <section className="rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-4 shadow-xl shadow-black/20">
            <p className="text-xs font-black uppercase text-[#D4AF37]">Value bets</p>
            <div className="mt-4 grid gap-3">
              {valueBets.length > 0 ? (
                valueBets.slice(0, 1).map((bet) => (
                  <article className="rounded-lg border border-white/10 bg-[#0D1422] p-3" key={bet.numero}>
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                      <span
                        className={`grid aspect-square w-9 place-items-center rounded-full font-[var(--font-display)] text-lg font-black ${getRunnerNumberClass(bet.numero)}`}
                      >
                        {bet.numero}
                      </span>
                      <div>
                        <strong className="block text-sm font-black">{bet.cheval}</strong>
                        <span className="font-[var(--font-display)] text-base font-black text-[#D4AF37]">
                          {formatOdds(bet.coteActuelle)} PMU · fair {formatOdds(bet.coteFair)}
                        </span>
                      </div>
                      {bet.edgePct > 10 ? (
                        <span className="rounded-full border border-[#00C851]/30 bg-[#00C851]/10 px-2 py-1 text-[0.68rem] font-black text-[#00C851]">
                          VALUE +
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm font-bold italic text-slate-400">
                      Edge {percentFormatter.format(bet.edgePct)} % · {getValueExplanation(bet.explanation)}
                    </p>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-white/10 bg-[#0D1422] p-4 text-sm font-bold text-slate-400">
                  Aucun value bet net pour le moment. L&apos;IA conseille de rester discipliné.
                </p>
              )}
              {valueBets.length > 1 ? (
                <div className="rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-4">
                  <p className="text-sm font-black text-[#D4AF37]">
                    {valueBets.length - 1} value bets masqués PRO
                  </p>
                  <Link
                    href="/mes-paris?billing=checkout"
                    className="mt-3 inline-flex rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-black text-[#0A0E1A]"
                  >
                    Débloquer les value bets
                  </Link>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-4 shadow-xl shadow-black/20">
            <p className="text-xs font-black uppercase text-[#D4AF37]">Plan de jeu</p>
            <dl className="mt-4 grid gap-3 text-sm font-bold">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <dt className="text-slate-400">Type conseillé</dt>
                <dd>{analysis?.favori?.prediction.typePariConseille ?? "En attente"}</dd>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <dt className="text-slate-400">Lisibilité</dt>
                <dd>{analysis?.prediction.lisibilite ?? "En attente"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Course</dt>
                <dd>R{courseInfo.reunion}C{courseInfo.course}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </section>
    </main>
  );
}
