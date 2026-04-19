import type { Metadata } from "next";
import Link from "next/link";
import { getTodayDateStr, toIsoDate } from "@/lib/date-utils";
import {
  listPredictionsBetween,
  listRunnerOutcomesBetween,
} from "@/lib/prediction-store";
import type { PredictionRow, RunnerOutcomeRow } from "@/lib/types";

export const metadata: Metadata = {
  title: "Stats PMU Gagnant - ROI et historique",
  description:
    "Statistiques TurfEdge : ROI global, taux de reussite, historique des dernieres selections et performances PMU.",
};

export const dynamic = "force-dynamic";

type SettledSelection = {
  race: string;
  horse: string;
  stake: number;
  gain: number;
  won: boolean;
};

function getRaceKey(row: Pick<PredictionRow | RunnerOutcomeRow, "date" | "reunion" | "course">) {
  return `${row.date}-${row.reunion}-${row.course}`;
}

function getRunnerKey(row: Pick<PredictionRow | RunnerOutcomeRow, "date" | "reunion" | "course" | "cheval_num">) {
  return `${getRaceKey(row)}-${row.cheval_num}`;
}

function getSelectionPriority(row: PredictionRow) {
  if (row.decision === "VALIDE") return 3;
  if (row.decision === "SURVEILLANCE") return 2;
  return 1;
}

function getSelectionScore(row: PredictionRow) {
  return row.score_blended ?? row.score_cheval ?? row.score_final_pari ?? 0;
}

function getSelectedPredictions(rows: PredictionRow[]) {
  const byRace = new Map<string, PredictionRow[]>();

  for (const row of rows) {
    if (row.decision === "REJET" || row.non_partant || (row.mise_simulee ?? 0) <= 0) {
      continue;
    }

    const key = getRaceKey(row);
    const current = byRace.get(key) ?? [];
    current.push(row);
    byRace.set(key, current);
  }

  return [...byRace.values()].flatMap((raceRows) => {
    const selected = [...raceRows].sort((left, right) => {
      const priorityDiff = getSelectionPriority(right) - getSelectionPriority(left);
      if (priorityDiff !== 0) return priorityDiff;
      return getSelectionScore(right) - getSelectionScore(left);
    })[0];

    return selected ? [selected] : [];
  });
}

function getRealGain(row: PredictionRow, outcome: RunnerOutcomeRow) {
  const stake = row.mise_simulee ?? 0;
  const betType = row.pari_conseille ?? "GAGNANT";

  if (betType === "PLACE") {
    if (!outcome.resultat_place) return 0;
    return stake * (outcome.rapport_place ?? row.rapport_place ?? 1);
  }

  if (!outcome.resultat_gagnant) return 0;
  return stake * (outcome.rapport_gagnant ?? row.rapport_gagnant ?? 1);
}

function buildSettledSelections(
  predictions: PredictionRow[],
  outcomes: RunnerOutcomeRow[]
): SettledSelection[] {
  const outcomesByRunner = new Map(
    outcomes.map((outcome) => [getRunnerKey(outcome), outcome] as const)
  );

  return getSelectedPredictions(predictions).flatMap((row) => {
    const outcome = outcomesByRunner.get(getRunnerKey(row));
    if (!outcome || outcome.non_partant) {
      return [];
    }

    const stake = row.mise_simulee ?? 0;
    const gain = getRealGain(row, outcome);
    return [
      {
        race: `R${row.reunion}C${row.course}`,
        horse: row.cheval_nom,
        stake,
        gain,
        won: gain > stake,
      },
    ];
  });
}

function formatEuro(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${value >= 0 ? "+" : ""}${new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)}`;
}

export default async function StatsPage() {
  const endIso = toIsoDate(getTodayDateStr());
  const startDate = new Date(`${endIso}T12:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 90);
  const startIso = startDate.toISOString().slice(0, 10);
  const [predictions, outcomes] = await Promise.all([
    listPredictionsBetween(startIso, endIso).catch(() => []),
    listRunnerOutcomesBetween(startIso, endIso).catch(() => []),
  ]);
  const settled = buildSettledSelections(predictions, outcomes);
  const totalStake = settled.reduce((sum, row) => sum + row.stake, 0);
  const totalGain = settled.reduce((sum, row) => sum + row.gain, 0);
  const net = totalStake > 0 ? totalGain - totalStake : null;
  const roi = totalStake > 0 && net !== null ? (net / totalStake) * 100 : null;
  const hitRate =
    settled.length > 0
      ? (settled.filter((row) => row.won).length / settled.length) * 100
      : null;
  const history = settled.slice(-12).reverse();

  return (
    <main className="min-h-screen bg-[#0A0E1A] px-4 py-6 text-[#F6F2E8]">
      <section className="mx-auto grid w-full max-w-[92rem] gap-5">
        <header className="rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-5 shadow-2xl shadow-black/25 md:p-7">
          <Link href="/dashboard" className="text-xs font-black uppercase text-[#D4AF37]">
            Retour dashboard
          </Link>
          <h1 className="mt-3 font-[var(--font-display)] text-5xl font-black leading-none md:text-7xl">
            Stats TurfEdge
          </h1>
          <p className="mt-3 text-sm font-bold text-slate-400">
            ROI global, taux de reussite et historique des selections mesurees sur 90 jours.
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <article className="rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-5">
            <p className="text-xs font-black uppercase text-[#D4AF37]">ROI global</p>
            <p className={`mt-2 font-[var(--font-display)] text-5xl font-black ${roi === null ? "text-slate-400" : roi >= 0 ? "text-[#00C851]" : "text-[#FF4D5A]"}`}>
              {roi === null ? "--" : `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`}
            </p>
          </article>
          <article className="rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-5">
            <p className="text-xs font-black uppercase text-[#D4AF37]">Taux reussite</p>
            <p className="mt-2 font-[var(--font-display)] text-5xl font-black text-[#F6F2E8]">
              {hitRate === null ? "--" : `${hitRate.toFixed(0)}%`}
            </p>
          </article>
          <article className="rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-5">
            <p className="text-xs font-black uppercase text-[#D4AF37]">Gain net</p>
            <p className={`mt-2 font-[var(--font-display)] text-5xl font-black ${net === null ? "text-slate-400" : net >= 0 ? "text-[#00C851]" : "text-[#FF4D5A]"}`}>
              {formatEuro(net)}
            </p>
          </article>
        </section>

        <section className="rounded-lg border border-white/10 bg-[#101827] shadow-2xl shadow-black/20">
          <div className="border-b border-white/10 p-4">
            <h2 className="font-[var(--font-display)] text-3xl font-black">
              Historique recent
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="px-4 py-3 font-black">Course</th>
                  <th className="px-4 py-3 font-black">Cheval</th>
                  <th className="px-4 py-3 text-right font-black">Mise</th>
                  <th className="px-4 py-3 text-right font-black">Gain/Perte</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr
                    className={`border-t border-white/10 ${row.won ? "bg-[#00C851]/8" : "bg-[#FF4D5A]/8"}`}
                    key={`${row.race}-${row.horse}-${row.stake}-${row.gain}`}
                  >
                    <td className="px-4 py-3 font-black">{row.race}</td>
                    <td className="px-4 py-3 font-bold">{row.horse}</td>
                    <td className="px-4 py-3 text-right font-bold">{row.stake.toFixed(0)} EUR</td>
                    <td className={`px-4 py-3 text-right font-black ${row.gain - row.stake >= 0 ? "text-[#00C851]" : "text-[#FF4D5A]"}`}>
                      {formatEuro(row.gain - row.stake)}
                    </td>
                  </tr>
                ))}
                {history.length === 0 ? (
                  <tr className="border-t border-white/10">
                    <td className="px-4 py-5 text-sm font-black text-slate-400" colSpan={4}>
                      Aucun resultat officiel exploitable pour cette periode.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
