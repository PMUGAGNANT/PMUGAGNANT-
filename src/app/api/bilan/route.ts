import { NextResponse } from "next/server";
import { getAllRaces, getDefinitiveRapports, getParticipants, getTodayDateStr } from "@/lib/pmu-api";
import { analyzeRace, getMinutesUntilStart } from "@/lib/analysis";
import type { BetRecommendationType } from "@/lib/types";

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
  pariType: BetRecommendationType;
  pariLabel: string;
  chevaux: Array<{
    numPmu: number;
    nom: string;
    cotePmu: number | null;
    coteEstimee: number | null;
    ordreArrivee: number | null;
  }>;
  recommandation: string;
  confiance: number;
  resultat: BilanResultat;
  gainPour1Euro: number | null;
  beneficeNetPour1Euro: number | null;
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

function getBeneficeNetPour1Euro(gainPour1Euro: number | null): number | null {
  if (gainPour1Euro === null) return null;
  const benefice = gainPour1Euro - 1;
  return benefice > 0 ? benefice : 0;
}

function getResultatPari(
  pariType: BetRecommendationType,
  ordreArrivee: Array<number | null>
): BilanResultat {
  if (ordreArrivee.some((position) => position === null)) {
    return "INCONNU";
  }

  if (pariType === "SIMPLE_GAGNANT") {
    const position = ordreArrivee[0];
    if (position === 1) return "GAGNANT";
    if (position !== null && position <= 3) return "PLACE";
    return "PERDU";
  }

  if (pariType === "COUPLE_PLACE") {
    return ordreArrivee.every((position) => position !== null && position <= 3)
      ? "GAGNANT"
      : "PERDU";
  }

  if (pariType === "COUPLE_GAGNANT") {
    return ordreArrivee.every((position) => position !== null && position <= 2)
      ? "GAGNANT"
      : "PERDU";
  }

  return "INCONNU";
}

function getPariLabel(pariType: BetRecommendationType): string {
  if (pariType === "SIMPLE_GAGNANT") return "Simple gagnant";
  if (pariType === "COUPLE_PLACE") return "Couple place";
  return "Couple gagnant";
}

function normalizeCombinaisonForLookup(nums: number[]): string {
  return [...nums].sort((left, right) => left - right).join("-");
}

function getRapportFinalPour1Euro(
  pariType: BetRecommendationType,
  resultat: BilanResultat,
  numeros: number[],
  definitiveRapports: Record<string, Record<string, number>>
): number | null {
  if (pariType === "SIMPLE_GAGNANT") {
    const simpleKey = String(numeros[0]);
    if (resultat === "GAGNANT") {
      return definitiveRapports.SIMPLE_GAGNANT?.[simpleKey] ?? null;
    }
    if (resultat === "PLACE") {
      return definitiveRapports.SIMPLE_PLACE?.[simpleKey] ?? null;
    }
    return null;
  }

  const combinaisonKey = normalizeCombinaisonForLookup(numeros);
  if (pariType === "COUPLE_PLACE" && resultat === "GAGNANT") {
    return definitiveRapports.COUPLE_PLACE?.[combinaisonKey] ?? null;
  }
  if (pariType === "COUPLE_GAGNANT" && resultat === "GAGNANT") {
    return definitiveRapports.COUPLE_GAGNANT?.[combinaisonKey] ?? null;
  }

  return null;
}

function getSimpleFallbackRapportPour1Euro(
  resultat: BilanResultat,
  numPmu: number,
  definitiveRapports: Record<string, Record<string, number>>
): number | null {
  if (resultat === "GAGNANT") {
    return definitiveRapports.SIMPLE_GAGNANT?.[String(numPmu)] ?? null;
  }

  if (resultat === "PLACE") {
    return definitiveRapports.SIMPLE_PLACE?.[String(numPmu)] ?? null;
  }

  return null;
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
        const [participants, definitiveRapports] = await Promise.all([
          getParticipants(date, race.reunion, race.course),
          getDefinitiveRapports(date, race.reunion, race.course).catch(() => ({})),
        ]);
        const analysis = analyzeRace(race, participants);
        if (analysis.parisRecommandes.length === 0) continue;

        for (const pari of analysis.parisRecommandes) {
          const chevaux = pari.chevaux.map((cheval) => {
            const participant = participants.find((entry) => entry.numPmu === cheval.numPmu);
            const predictedOdds = analysis.predictionsCotes[cheval.numPmu];

            return {
              numPmu: cheval.numPmu,
              nom: cheval.nom,
              cotePmu: participant?.cote ?? null,
              coteEstimee:
                predictedOdds?.coteEstimee ??
                predictedOdds?.coteMatin ??
                null,
              ordreArrivee: participant?.ordreArrivee ?? null,
            };
          });

          const ordreArrivee = chevaux.map((cheval) => cheval.ordreArrivee);
          const resultat = getResultatPari(pari.type, ordreArrivee);
          const rapportFinalPour1Euro =
            getRapportFinalPour1Euro(
              pari.type,
              resultat,
              chevaux.map((cheval) => cheval.numPmu),
              definitiveRapports
            ) ??
            (pari.type === "SIMPLE_GAGNANT"
              ? getSimpleFallbackRapportPour1Euro(
                  resultat,
                  chevaux[0]?.numPmu ?? 0,
                  definitiveRapports
                ) ??
                getGainPour1Euro(resultat, chevaux[0]?.cotePmu ?? null)
              : null);

          results.push({
            courseInfo: {
              reunion: race.reunion,
              course: race.course,
              hippodrome: race.hippodrome,
              heureDepart: race.heureDepart,
              discipline: race.discipline,
              nomCourse: race.nomCourse,
            },
            pariType: pari.type,
            pariLabel: getPariLabel(pari.type),
            chevaux,
            recommandation: pari.pourquoi[0] ?? analysis.recommandation?.decision ?? "-",
            confiance: pari.surete ?? analysis.scoreConfiance?.score ?? 0,
            resultat,
            gainPour1Euro: rapportFinalPour1Euro,
            beneficeNetPour1Euro: getBeneficeNetPour1Euro(rapportFinalPour1Euro),
          });
        }
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
