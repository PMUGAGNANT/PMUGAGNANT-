import type { Metadata } from "next";
import Link from "next/link";
import {
  buildValueBets,
  formatOdds,
  formatRaceAnalysisId,
  getRunnerNumberClass,
} from "@/features/vmax/vmax-model";
import { getTodayDateStr } from "@/lib/date-utils";
import { listPredictionsByDate } from "@/lib/prediction-store";
import type { PredictionRow } from "@/lib/types";

export const metadata: Metadata = {
  title: "Value Bets du jour - PMU Gagnant",
  description:
    "Toutes les value bets PMU du jour detectees par l'IA TurfEdge, avec cote actuelle, cote fair et edge.",
};

export const dynamic = "force-dynamic";

type ValueBetCard = {
  date: string;
  reunion: number;
  course: number;
  hippodrome: string;
  numero: number;
  cheval: string;
  coteActuelle: number;
  coteFair: number;
  edgePct: number;
  explanation: string;
};

function getPredictionScore(row: PredictionRow) {
  return row.score_blended ?? row.score_cheval ?? row.score_final_pari ?? null;
}

function getPredictionOdds(row: PredictionRow) {
  return row.cote_depart ?? row.cote_matin ?? null;
}

function buildCards(rows: PredictionRow[]): ValueBetCard[] {
  const byRace = new Map<string, PredictionRow[]>();

  for (const row of rows) {
    const key = `${row.date}-${row.reunion}-${row.course}`;
    const current = byRace.get(key) ?? [];
    current.push(row);
    byRace.set(key, current);
  }

  return [...byRace.values()]
    .flatMap((raceRows) => {
      const first = raceRows[0];
      if (!first) return [];

      return buildValueBets(
        raceRows.map((row) => ({
          numero: row.cheval_num,
          cheval: row.cheval_nom,
          cote: getPredictionOdds(row),
          scoreIa: getPredictionScore(row),
          raison: row.avis_texte,
        })),
        6
      ).map((bet) => ({
        date: first.date,
        reunion: first.reunion,
        course: first.course,
        hippodrome: first.hippodrome,
        numero: bet.numero,
        cheval: bet.cheval,
        coteActuelle: bet.coteActuelle,
        coteFair: bet.coteFair,
        edgePct: bet.edgePct,
        explanation: bet.explanation,
      }));
    })
    .sort((left, right) => right.edgePct - left.edgePct);
}

export default async function ValueBetsPage() {
  const date = getTodayDateStr();
  const predictions = await listPredictionsByDate(date).catch(() => []);
  const cards = buildCards(predictions);

  return (
    <main className="min-h-screen bg-[#0A0E1A] px-4 py-6 text-[#F6F2E8]">
      <section className="mx-auto grid w-full max-w-[92rem] gap-5">
        <header className="rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-5 shadow-2xl shadow-black/25 md:p-7">
          <Link href="/dashboard" className="text-xs font-black uppercase text-[#D4AF37]">
            Retour dashboard
          </Link>
          <h1 className="mt-3 font-[var(--font-display)] text-5xl font-black leading-none md:text-7xl">
            Value Bets du jour
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-7 text-slate-400">
            Les chevaux dont la cote PMU semble superieure a la cote fair calculee par
            l&apos;IA. Discipline d&apos;abord : une value bet n&apos;est pas une garantie.
          </p>
        </header>

        {cards.length === 0 ? (
          <section className="rounded-lg border border-white/10 bg-[#101827] p-6 text-sm font-black text-slate-400">
            Analyse en cours : aucune value bet nette n&apos;est disponible pour le moment.
          </section>
        ) : (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <Link
                href={`/race/${formatRaceAnalysisId(card.reunion, card.course)}?date=${card.date
                  .split("-")
                  .reverse()
                  .join("")}`}
                key={`${card.date}-${card.reunion}-${card.course}-${card.numero}`}
                className="group rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-4 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-[#D4AF37]/45"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-[#D4AF37]">
                      R{card.reunion}C{card.course} · {card.hippodrome}
                    </p>
                    <h2 className="mt-2 text-2xl font-black leading-tight text-[#F6F2E8]">
                      {card.cheval}
                    </h2>
                  </div>
                  <span
                    className={`grid aspect-square w-10 shrink-0 place-items-center rounded-full font-[var(--font-display)] text-xl font-black ${getRunnerNumberClass(card.numero)}`}
                  >
                    {card.numero}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[0.65rem] font-black uppercase text-slate-500">PMU</p>
                    <p className="font-[var(--font-display)] text-2xl font-black text-[#D4AF37]">
                      {formatOdds(card.coteActuelle)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[0.65rem] font-black uppercase text-slate-500">Fair</p>
                    <p className="font-[var(--font-display)] text-2xl font-black text-[#F6F2E8]">
                      {formatOdds(card.coteFair)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#00C851]/25 bg-[#00C851]/10 p-3">
                    <p className="text-[0.65rem] font-black uppercase text-[#00C851]">Edge</p>
                    <p className="font-[var(--font-display)] text-2xl font-black text-[#00C851]">
                      +{card.edgePct.toFixed(0)}%
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm font-bold italic leading-6 text-slate-400">
                  {card.explanation}
                </p>
              </Link>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
