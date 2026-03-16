import { NextResponse } from "next/server";
import { analyzeRace, getMinutesUntilStart } from "@/lib/analysis";
import { getAllRaces, getParticipants, getTodayDateStr } from "@/lib/pmu-api";

export const dynamic = "force-dynamic";

type BilanPariResultat = "GAGNANT" | "PLACE" | "PERDU" | "INCONNU";

function getPariLabel(type: string) {
  switch (type) {
    case "SIMPLE_GAGNANT":
      return "Simple gagnant";
    case "COUPLE_PLACE":
      return "Couple place";
    case "COUPLE_GAGNANT":
      return "Couple gagnant";
    default:
      return type;
  }
}

function getPariResultat(
  type: string,
  ordreArrivee1?: number | null,
  ordreArrivee2?: number | null
): BilanPariResultat {
  if (!ordreArrivee1) {
    return "INCONNU";
  }

  if (type === "SIMPLE_GAGNANT") {
    if (ordreArrivee1 === 1) return "GAGNANT";
    if (ordreArrivee1 <= 3) return "PLACE";
    return "PERDU";
  }

  if (!ordreArrivee2) {
    return "INCONNU";
  }

  if (type === "COUPLE_PLACE") {
    return ordreArrivee1 <= 3 && ordreArrivee2 <= 3 ? "PLACE" : "PERDU";
  }

  if (type === "COUPLE_GAGNANT") {
    return ordreArrivee1 <= 2 && ordreArrivee2 <= 2 ? "GAGNANT" : "PERDU";
  }

  return "INCONNU";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || getTodayDateStr();

  try {
    const races = await getAllRaces(date);
    const results = [];

    for (const race of races) {
      const minutesUntil = getMinutesUntilStart(race.heureDepart);

      if (minutesUntil < -10) {
        try {
          const participants = await getParticipants(date, race.reunion, race.course);
          const analysis = analyzeRace(race, participants);

          if (!analysis || !analysis.favori) {
            continue;
          }

          const paris = analysis.parisRecommandes?.length
            ? analysis.parisRecommandes
            : [
                {
                  type: "SIMPLE_GAGNANT",
                  label: "Simple gagnant",
                  chevaux: [{ numPmu: analysis.favori.numPmu, nom: analysis.favori.nom }],
                  surete: analysis.scoreConfiance?.score ?? 0,
                },
              ];

          for (const pari of paris) {
            const premierCheval = pari.chevaux[0];
            const secondCheval = pari.chevaux[1] ?? null;
            const premierResultat = participants.find((p) => p.numPmu === premierCheval?.numPmu);
            const secondResultat = secondCheval
              ? participants.find((p) => p.numPmu === secondCheval.numPmu)
              : null;
            const ordreArrivee = premierResultat?.ordreArrivee ?? null;
            const ordreArriveeSecond = secondResultat?.ordreArrivee ?? null;

            results.push({
              courseInfo: race,
              favori: { numPmu: premierCheval.numPmu, nom: premierCheval.nom },
              secondCheval: secondCheval
                ? { numPmu: secondCheval.numPmu, nom: secondCheval.nom }
                : null,
              typePari: getPariLabel(pari.type),
              recommandation: pari.label || analysis.recommandation?.decision || "-",
              confiance: pari.surete ?? analysis.scoreConfiance?.score ?? 0,
              resultat: getPariResultat(pari.type, ordreArrivee, ordreArriveeSecond),
              ordreArrivee: ordreArrivee ?? undefined,
              ordreArriveeSecond: ordreArriveeSecond ?? undefined,
            });
          }
        } catch {
          continue;
        }
      }
    }

    const totalPlayed = results.filter((r) => r.resultat !== "INCONNU").length;
    const wins = results.filter((r) => r.resultat === "GAGNANT").length;
    const places = results.filter((r) => r.resultat === "PLACE").length;

    return NextResponse.json({
      success: true,
      date,
      summary: {
        totalRaces: races.length,
        totalPlayed,
        wins,
        places,
        losses: totalPlayed - wins - places,
      },
      results,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Bilan failed" }, { status: 500 });
  }
}
