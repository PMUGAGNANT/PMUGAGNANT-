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
  startDate.setUTCDate(startDate.getUTCDate() - 30);
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
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
      <section className="app-page-hero p-6 md:p-8">
        <div className="relative z-[1] grid gap-6 xl:grid-cols-[1.08fr,0.92fr] xl:items-end">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[var(--pmu-primary-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--pmu-primary)]">
                Stats TurfEdge
              </span>
              <span className="app-pill text-xs">30 jours</span>
              <span className="app-pill text-xs">{settled.length} selections</span>
            </div>

            <div>
              <p className="app-kicker">Mesure officielle</p>
              <h1 className="max-w-4xl text-4xl font-black leading-[0.93] text-[var(--pmu-text)] md:text-6xl">
                ROI, taux de reussite et historique recent.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
                Les chiffres ci-dessous utilisent les selections mesurees, les mises
                simulees et les resultats officiels rapproches sur les 30 derniers jours.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/dashboard" className="app-button-secondary justify-center">
              Retour dashboard
            </Link>
            <Link href="/bilan" className="app-button-primary justify-center">
              Bilan complet
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="app-stat-card px-5 py-5">
          <p className="app-label">ROI global</p>
          <p
            className="mt-2 text-5xl font-black leading-none"
            style={{
              color:
                roi === null
                  ? "var(--pmu-text-muted)"
                  : roi >= 0
                    ? "var(--pmu-primary)"
                    : "var(--pmu-red)",
            }}
          >
            {roi === null ? "--" : `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`}
          </p>
        </article>

        <article className="app-stat-card px-5 py-5">
          <p className="app-label">Taux reussite</p>
          <p className="mt-2 text-5xl font-black leading-none text-[var(--pmu-text)]">
            {hitRate === null ? "--" : `${hitRate.toFixed(0)}%`}
          </p>
        </article>

        <article className="app-stat-card px-5 py-5">
          <p className="app-label">Gain net</p>
          <p
            className="mt-2 text-5xl font-black leading-none"
            style={{
              color:
                net === null
                  ? "var(--pmu-text-muted)"
                  : net >= 0
                    ? "var(--pmu-primary)"
                    : "var(--pmu-red)",
            }}
          >
            {formatEuro(net)}
          </p>
        </article>
      </section>

      <section className="app-card overflow-hidden p-0">
        <div className="app-section-heading p-5 md:p-6">
          <div>
            <p className="app-kicker">Historique</p>
            <h2 className="app-section-title">Selections recentes</h2>
          </div>
          <span className="app-pill text-xs">{history.length} lignes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="border-y border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] text-[var(--pmu-text-muted)]">
              <tr>
                <th className="px-5 py-3 font-black">Course</th>
                <th className="px-5 py-3 font-black">Cheval</th>
                <th className="px-5 py-3 text-right font-black">Mise</th>
                <th className="px-5 py-3 text-right font-black">Gain/Perte</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => {
                const profit = row.gain - row.stake;

                return (
                  <tr
                    className="border-b border-[var(--pmu-border)] last:border-b-0"
                    key={`${row.race}-${row.horse}-${row.stake}-${row.gain}`}
                  >
                    <td className="px-5 py-4 font-black text-[var(--pmu-text)]">
                      {row.race}
                    </td>
                    <td className="px-5 py-4 font-bold text-[var(--pmu-text)]">
                      {row.horse}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-[var(--pmu-text-soft)]">
                      {row.stake.toFixed(0)} EUR
                    </td>
                    <td
                      className="px-5 py-4 text-right font-black"
                      style={{
                        color: profit >= 0 ? "var(--pmu-primary)" : "var(--pmu-red)",
                      }}
                    >
                      {formatEuro(profit)}
                    </td>
                  </tr>
                );
              })}
              {history.length === 0 ? (
                <tr>
                  <td
                    className="px-5 py-8 text-center text-sm font-black text-[var(--pmu-text-soft)]"
                    colSpan={4}
                  >
                    Aucun resultat officiel exploitable pour cette periode.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
