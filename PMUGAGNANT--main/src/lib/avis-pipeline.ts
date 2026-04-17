import { toIsoDate } from "@/lib/date-utils";
import {
  calculerNote,
  calculerVerdict,
  genererAvisComplet,
  type AvisExpertPrediction,
  type AvisPariType,
  type AvisVerdict,
  type ChevalPourAvis,
} from "@/lib/avis-generator";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/server-logger";
import type {
  CourseRecordRow,
  Lisibilite,
  Participant,
  PredictionDecision,
  RaceAnalysis,
  RaceSummary,
} from "@/lib/types";

const AVIS_REFRESH_HOURS = 2;

interface PredictionAvisRow {
  date: string;
  reunion: number;
  course: number;
  hippodrome: string;
  cheval_num: number;
  cheval_nom: string;
  score_cheval: number | null;
  confiance: number | null;
  qualite: number | null;
  lisibilite: Lisibilite | null;
  decision: PredictionDecision | null;
  value: number | null;
  cote_matin: number | null;
  non_partant: boolean | null;
  avis_texte?: string | null;
  avis_note?: number | null;
  avis_verdict?: AvisVerdict | null;
  avis_pari_type?: AvisPariType | null;
  avis_generated_at?: string | null;
}

function normalizeDateForStorage(dateStr: string) {
  return /^\d{8}$/.test(dateStr) ? toIsoDate(dateStr) : dateStr;
}

function shouldRefreshAvis(generatedAt?: string | null) {
  if (!generatedAt) return true;

  const generatedTime = new Date(generatedAt).getTime();
  if (!Number.isFinite(generatedTime)) return true;

  return (Date.now() - generatedTime) / 3_600_000 >= AVIS_REFRESH_HOURS;
}

function asFiniteNumber(value: number | null | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getChevalPourAvis(
  prediction: PredictionAvisRow,
  course: CourseRecordRow | null
): ChevalPourAvis {
  return {
    cheval_nom: prediction.cheval_nom,
    cheval_num: prediction.cheval_num,
    cote_matin: asFiniteNumber(prediction.cote_matin),
    score_cheval: asFiniteNumber(prediction.score_cheval),
    confiance: asFiniteNumber(prediction.confiance),
    qualite: asFiniteNumber(prediction.qualite, asFiniteNumber(prediction.score_cheval)),
    lisibilite: prediction.lisibilite ?? "COMPLEXE",
    decision: prediction.decision ?? "REJET",
    value: asFiniteNumber(prediction.value),
    performances_recentes: "",
    hippodrome: prediction.hippodrome || course?.hippodrome || "",
    distance: asFiniteNumber(course?.distance),
    discipline: course?.discipline ?? "",
  };
}

function toAvisExpertPrediction(
  prediction: PredictionAvisRow,
  performancesRecentes = ""
): AvisExpertPrediction {
  return {
    cheval_num: prediction.cheval_num,
    cheval_nom: prediction.cheval_nom,
    cote_matin: prediction.cote_matin ?? null,
    score_cheval: asFiniteNumber(prediction.score_cheval),
    confiance: asFiniteNumber(prediction.confiance),
    value: prediction.value ?? null,
    avis_texte: prediction.avis_texte ?? null,
    avis_note: prediction.avis_note ?? null,
    avis_verdict: prediction.avis_verdict ?? null,
    avis_pari_type: prediction.avis_pari_type ?? null,
    avis_generated_at: prediction.avis_generated_at ?? null,
    performances_recentes: performancesRecentes,
  };
}

export async function fetchAvisExpertTop5(
  dateStr: string,
  reunion: number,
  course: number
): Promise<AvisExpertPrediction[]> {
  const admin = getSupabaseAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("predictions")
    .select(
      "date,reunion,course,hippodrome,cheval_num,cheval_nom,score_cheval,confiance,qualite,lisibilite,decision,value,cote_matin,non_partant,avis_texte,avis_note,avis_verdict,avis_pari_type,avis_generated_at"
    )
    .eq("date", normalizeDateForStorage(dateStr))
    .eq("reunion", reunion)
    .eq("course", course)
    .eq("non_partant", false)
    .order("score_cheval", { ascending: false })
    .limit(5);

  if (error) {
    logger.warn("avis.fetch_top5_failed", {
      dateStr,
      reunion,
      course,
      error: error.message,
    });
    return [];
  }

  return ((data ?? []) as PredictionAvisRow[]).map((prediction) =>
    toAvisExpertPrediction(prediction)
  );
}

export function buildAvisExpertFromAnalysis(
  analysis: RaceAnalysis,
  participants: Participant[],
  race: RaceSummary,
  storedAvis: AvisExpertPrediction[] = []
): AvisExpertPrediction[] {
  const storedByHorse = new Map(
    storedAvis.map((avis) => [avis.cheval_num, avis] as const)
  );
  const participantByHorse = new Map(
    participants.map((participant) => [participant.numPmu, participant] as const)
  );

  return [...analysis.ranking]
    .sort(
      (left, right) =>
        right.prediction.scoreCheval - left.prediction.scoreCheval ||
        left.numPmu - right.numPmu
    )
    .slice(0, 5)
    .map((runner) => {
      const stored = storedByHorse.get(runner.numPmu);
      const participant = participantByHorse.get(runner.numPmu);
      const cheval: ChevalPourAvis = {
        cheval_nom: runner.nom,
        cheval_num: runner.numPmu,
        cote_matin: asFiniteNumber(runner.coteMatin ?? runner.cote ?? runner.coteDepart),
        score_cheval: runner.prediction.scoreCheval,
        confiance: runner.prediction.confiance,
        qualite: runner.prediction.qualite,
        lisibilite: analysis.prediction.lisibilite,
        decision: runner.prediction.decision,
        value: runner.prediction.valueEffective,
        performances_recentes: participant?.musique ?? runner.musique ?? "",
        hippodrome: race.hippodrome,
        distance: race.distance,
        discipline: race.discipline,
        entraineur: runner.entraineur,
        jockey: runner.jockey || runner.driver,
      };
      const fallbackNote = calculerNote(cheval);
      const fallbackVerdict = calculerVerdict(
        fallbackNote,
        cheval.lisibilite,
        cheval.decision
      );

      return {
        cheval_num: runner.numPmu,
        cheval_nom: runner.nom,
        cote_matin: runner.coteMatin ?? runner.cote ?? runner.coteDepart ?? null,
        score_cheval: runner.prediction.scoreCheval,
        confiance: runner.prediction.confiance,
        value: runner.prediction.valueEffective,
        avis_texte: stored?.avis_texte ?? null,
        avis_note: stored?.avis_note ?? fallbackNote,
        avis_verdict: stored?.avis_verdict ?? fallbackVerdict.verdict,
        avis_pari_type: stored?.avis_pari_type ?? fallbackVerdict.pari_type,
        avis_generated_at: stored?.avis_generated_at ?? null,
        performances_recentes: cheval.performances_recentes,
      };
    });
}

export async function genererAvisCourse(
  dateStr: string,
  reunion: number,
  course: number
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const storageDate = normalizeDateForStorage(dateStr);
  const { data: predictions, error } = await admin
    .from("predictions")
    .select(
      "date,reunion,course,hippodrome,cheval_num,cheval_nom,score_cheval,confiance,qualite,lisibilite,decision,value,cote_matin,non_partant,avis_texte,avis_note,avis_verdict,avis_pari_type,avis_generated_at"
    )
    .eq("date", storageDate)
    .eq("reunion", reunion)
    .eq("course", course)
    .eq("non_partant", false)
    .order("score_cheval", { ascending: false })
    .limit(5);

  if (error || !predictions || predictions.length === 0) {
    if (error) {
      logger.warn("avis.predictions_fetch_failed", {
        dateStr,
        reunion,
        course,
        error: error.message,
      });
    }
    return;
  }

  const { data: courseRow } = await admin
    .from("courses")
    .select("*")
    .eq("date", storageDate)
    .eq("reunion", reunion)
    .eq("course", course)
    .maybeSingle();

  const rows = predictions as PredictionAvisRow[];
  for (let index = 0; index < rows.length; index += 2) {
    const batch = rows.slice(index, index + 2);

    await Promise.all(
      batch.map(async (prediction) => {
        if (!shouldRefreshAvis(prediction.avis_generated_at)) {
          return;
        }

        try {
          const avis = await genererAvisComplet(
            getChevalPourAvis(prediction, (courseRow ?? null) as CourseRecordRow | null)
          );

          const { error: updateError } = await admin
            .from("predictions")
            .update({
              avis_texte: avis.texte,
              avis_note: avis.note,
              avis_verdict: avis.verdict,
              avis_pari_type: avis.pari_type,
              avis_generated_at: new Date().toISOString(),
            })
            .eq("date", storageDate)
            .eq("reunion", reunion)
            .eq("course", course)
            .eq("cheval_num", prediction.cheval_num);

          if (updateError) {
            logger.warn("avis.save_failed", {
              dateStr,
              reunion,
              course,
              cheval: prediction.cheval_nom,
              error: updateError.message,
            });
          }
        } catch (errorAvis) {
          logger.warn("avis.generation_failed_for_horse", {
            dateStr,
            reunion,
            course,
            cheval: prediction.cheval_nom,
            error: errorAvis instanceof Error ? errorAvis.message : String(errorAvis),
          });
        }
      })
    );
  }
}

export async function genererAvisJour(dateStr: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const storageDate = normalizeDateForStorage(dateStr);
  const { data: courses, error } = await admin
    .from("predictions")
    .select("reunion,course")
    .eq("date", storageDate)
    .eq("stage", "MATIN");

  if (error || !courses) {
    if (error) {
      logger.warn("avis.course_list_failed", {
        dateStr,
        error: error.message,
      });
    }
    return;
  }

  const coursesUniques = Array.from(
    new Map(
      (courses as Array<{ reunion: number; course: number }>).map((item) => [
        `${item.reunion}-${item.course}`,
        item,
      ])
    ).values()
  );

  for (const item of coursesUniques) {
    await genererAvisCourse(storageDate, item.reunion, item.course);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
