import { NextResponse } from "next/server";
import { getAllRaces, getParticipants, getTodayDateStr } from "@/lib/pmu-api";
import { analyzeRace, getMinutesUntilStart } from "@/lib/analysis";

export const dynamic = "force-dynamic";

type BilanResultat = "GAGNANT" | "PLACE" | "PERDU" | "INCONNU";

type ConfidenceBucketKey = "high" | "medium" | "low";

interface BilanResult {
  courseInfo: {
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
  gainPour1Euro: number | null;
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

function getGainPour1Euro(resultat: BilanResultat, cotePmu: number | null): number | null {
  if (resultat !== "GAGNANT") return null;
  if (cotePmu === null || !Number.isFinite(cotePmu) || cotePmu <= 0) return null;
  return cotePmu;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || getTodayDateStr();

  try {
    const races = await getAllRaces(date);
    const results: BilanResult[] = [];

    for (const race of races) {
      const minutesUntil = getMinutesUntilStart(race.heureDepart);
      if (minutesUntil >= -10) continue;

      try {
        const participants = await getParticipants(date, race.reunion, race.course);
        const analysis = analyzeRace(race, participants);
        if (!analysis.favori) continue;

        const favoriResult = participants.find(
          (participant) => participant.numPmu === analysis.favori?.numPmu
        );
        const predictedOdds = analysis.predictionsCotes[analysis.favori.numPmu];
        const ordreArrivee = favoriResult?.ordreArrivee ?? null;
        const resultat: BilanResultat =
          ordreArrivee === 1
            ? "GAGNANT"
            : ordreArrivee !== null && ordreArrivee <= 3
              ? "PLACE"
              : ordreArrivee !== null
                ? "PERDU"
                : "INCONNU";
        const cotePmu = favoriResult?.cote ?? analysis.favori.cote ?? null;

        results.push({
          courseInfo: {
            reunion: race.reunion,
            course: race.course,
            hippodrome: race.hippodrome,
            heureDepart: race.heureDepart,
            discipline: race.discipline,
            nomCourse: race.nomCourse,
          },
          favori: {
            numPmu: analysis.favori.numPmu,
            nom: analysis.favori.nom,
            cotePmu,
            coteEstimee:
              predictedOdds?.coteEstimee ??
              predictedOdds?.coteMatin ??
              null,
          },
          recommandation: analysis.recommandation?.decision || "-",
          confiance: analysis.scoreConfiance?.score ?? 0,
          resultat,
          ordreArrivee,
          gainPour1Euro: getGainPour1Euro(resultat, cotePmu),
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
