import { NextResponse } from "next/server";
import { getAllRaces, getParticipants, getTodayDateStr } from "@/lib/pmu-api";
import { analyzeRaceWithParameters, getMinutesUntilStart } from "@/lib/analysis";
import { attachFaultRates } from "@/lib/horse-faults";
import { loadAlgoParameters } from "@/lib/config";

export const dynamic = "force-dynamic";

type BilanResultat = "GAGNANT" | "PLACE" | "PERDU" | "INCONNU";

type ConfidenceBucketKey = "high" | "medium" | "low";

interface BilanResult {
  courseInfo: {
    dateStr: string;
    reunion: number;
    course: number;
    hippodrome: string;
    heureDepart: string;
    discipline: string;
    nomCourse: string;
  };
  favori: {
    numPmu: number;
    nom: string;
    cotePmu: number | null;
    coteEstimee: number | null;
  };
  recommandation: string;
  confiance: number;
  resultat: BilanResultat;
  ordreArrivee?: number | null;
}

function getTicketSimple(analysis: ReturnType<typeof analyzeRaceWithParameters>) {
  return (
    analysis.ranking.find(
      (runner) =>
        runner.prediction.decision !== "REJET" &&
        runner.prediction.typePariConseille === "GAGNANT"
    ) ??
    analysis.ranking.find((runner) => runner.prediction.decision !== "REJET") ??
    analysis.favori
  );
}

interface AggregateStats {
  played: number;
  success: number;
}

function createAggregate(): AggregateStats {
  return { played: 0, success: 0 };
}

function getConfidenceBucket(score: number): ConfidenceBucketKey {
  if (score >= 7.5) return "high";
  if (score >= 5.5) return "medium";
  return "low";
}

function getConfidenceBucketLabel(bucket: ConfidenceBucketKey): string {
  if (bucket === "high") return "Confiance elevee";
  if (bucket === "medium") return "Confiance moyenne";
  return "Confiance faible";
}

function getSuccessRate(stats: AggregateStats): number {
  if (stats.played === 0) return 0;
  return Math.round((stats.success / stats.played) * 100);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || getTodayDateStr();

  try {
    const algoParameters = await loadAlgoParameters();
    const races = await getAllRaces(date);
    const results: BilanResult[] = [];

    for (const race of races) {
      const minutesUntil = getMinutesUntilStart(race.heureDepart, race.dateStr);
      if (minutesUntil >= -10) continue;

      try {
        const participants = await attachFaultRates(
          await getParticipants(date, race.reunion, race.course)
        );
        const analysis = analyzeRaceWithParameters(race, participants, algoParameters);
        const ticketSimple = getTicketSimple(analysis);
        if (!ticketSimple) continue;

        const ticketResult = participants.find(
          (participant) => participant.numPmu === ticketSimple.numPmu
        );
        const predictedOdds = analysis.predictionsCotes[ticketSimple.numPmu];
        const ordreArrivee = ticketResult?.ordreArrivee ?? null;
        const resultat: BilanResultat =
          ordreArrivee === 1
            ? "GAGNANT"
            : ordreArrivee !== null && ordreArrivee <= 3
              ? "PLACE"
              : ordreArrivee !== null
                ? "PERDU"
                : "INCONNU";

        results.push({
          courseInfo: {
            dateStr: race.dateStr,
            reunion: race.reunion,
            course: race.course,
            hippodrome: race.hippodrome,
            heureDepart: race.heureDepart,
            discipline: race.discipline,
            nomCourse: race.nomCourse,
          },
          favori: {
            numPmu: ticketSimple.numPmu,
            nom: ticketSimple.nom,
            cotePmu: ticketResult?.cote ?? ticketSimple.cote ?? null,
            coteEstimee:
              predictedOdds?.coteEstimee ??
              predictedOdds?.coteMatin ??
              null,
          },
          recommandation:
            analysis.recommandation?.decision ||
            analysis.prediction.decisionCourse ||
            "-",
          confiance: analysis.scoreConfiance?.score ?? 0,
          resultat,
          ordreArrivee,
        });
      } catch {
        // Skip failed race fetches so the bilan stays available.
      }
    }

    results.sort((left, right) => {
      const resultOrder: Record<BilanResultat, number> = {
        GAGNANT: 0,
        PLACE: 1,
        PERDU: 2,
        INCONNU: 3,
      };

      if (resultOrder[left.resultat] !== resultOrder[right.resultat]) {
        return resultOrder[left.resultat] - resultOrder[right.resultat];
      }

      return right.confiance - left.confiance;
    });

    const playedResults = results.filter((result) => result.resultat !== "INCONNU");
    const wins = playedResults.filter((result) => result.resultat === "GAGNANT").length;
    const places = playedResults.filter((result) => result.resultat === "PLACE").length;
    const losses = playedResults.filter((result) => result.resultat === "PERDU").length;

    const byDiscipline: Record<string, AggregateStats> = {};
    const byConfidence: Record<ConfidenceBucketKey, AggregateStats> = {
      high: createAggregate(),
      medium: createAggregate(),
      low: createAggregate(),
    };

    for (const result of playedResults) {
      const disciplineKey = result.courseInfo.discipline || "AUTRE";
      if (!byDiscipline[disciplineKey]) {
        byDiscipline[disciplineKey] = createAggregate();
      }

      byDiscipline[disciplineKey].played += 1;
      if (result.resultat === "GAGNANT" || result.resultat === "PLACE") {
        byDiscipline[disciplineKey].success += 1;
      }

      const confidenceBucket = getConfidenceBucket(result.confiance);
      byConfidence[confidenceBucket].played += 1;
      if (result.resultat === "GAGNANT" || result.resultat === "PLACE") {
        byConfidence[confidenceBucket].success += 1;
      }
    }

    const disciplineEntries = Object.entries(byDiscipline)
      .map(([discipline, stats]) => ({
        discipline,
        played: stats.played,
        success: stats.success,
        rate: getSuccessRate(stats),
      }))
      .sort((left, right) => {
        if (right.rate !== left.rate) return right.rate - left.rate;
        return right.played - left.played;
      });

    const confidenceEntries = (Object.keys(byConfidence) as ConfidenceBucketKey[])
      .map((bucket) => ({
        bucket,
        label: getConfidenceBucketLabel(bucket),
        played: byConfidence[bucket].played,
        success: byConfidence[bucket].success,
        rate: getSuccessRate(byConfidence[bucket]),
      }))
      .sort((left, right) => {
        if (right.rate !== left.rate) return right.rate - left.rate;
        return right.played - left.played;
      });

    const bestDiscipline = disciplineEntries.find((entry) => entry.played >= 2) ?? disciplineEntries[0] ?? null;
    const worstDiscipline =
      [...disciplineEntries]
        .reverse()
        .find((entry) => entry.played >= 2) ??
      disciplineEntries[disciplineEntries.length - 1] ??
      null;

    const bestConfidenceBucket =
      confidenceEntries.find((entry) => entry.played > 0) ?? null;
    const worstConfidenceBucket =
      [...confidenceEntries].reverse().find((entry) => entry.played > 0) ?? null;

    const totalPlayed = playedResults.length;
    const successRate = totalPlayed > 0 ? Math.round(((wins + places) / totalPlayed) * 100) : 0;

    let healthLabel = "Journee neutre";
    if (successRate >= 45) healthLabel = "Journee solide";
    else if (successRate >= 30) healthLabel = "Journee correcte";
    else if (successRate >= 20) healthLabel = "Journee fragile";
    else healthLabel = "Journee difficile";

    const insights: string[] = [];
    if (bestDiscipline) {
      insights.push(
        `Le meilleur terrain du jour est ${bestDiscipline.discipline} (${bestDiscipline.rate}% de reussite sur ${bestDiscipline.played} courses).`
      );
    }
    if (worstDiscipline && worstDiscipline !== bestDiscipline) {
      insights.push(
        `Le point faible est ${worstDiscipline.discipline} (${worstDiscipline.rate}% sur ${worstDiscipline.played} courses).`
      );
    }
    if (bestConfidenceBucket) {
      insights.push(
        `${bestConfidenceBucket.label} est la zone la plus fiable (${bestConfidenceBucket.rate}% de reussite).`
      );
    }
    if (worstConfidenceBucket && worstConfidenceBucket !== bestConfidenceBucket) {
      insights.push(
        `${worstConfidenceBucket.label} reste la zone la plus risquee (${worstConfidenceBucket.rate}% de reussite).`
      );
    }

    return NextResponse.json({
      success: true,
      date,
      summary: {
        totalRaces: races.length,
        totalPlayed,
        wins,
        places,
        losses,
        successRate,
      },
      expert: {
        healthLabel,
        bestDiscipline,
        worstDiscipline,
        bestConfidenceBucket,
        worstConfidenceBucket,
        confidenceBuckets: confidenceEntries,
        disciplineBreakdown: disciplineEntries,
        insights,
      },
      results,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Bilan failed" },
      { status: 500 }
    );
  }
}
