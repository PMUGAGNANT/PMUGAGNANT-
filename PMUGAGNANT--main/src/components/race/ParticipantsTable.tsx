import { parseFavoriteForm } from "@/features/race/lib/favorite-form";
import {
  formatOdds,
  formatStakeEuro,
  getScoreBadgeLabel,
  formatStakeLabel,
  getRunnerNumberClass,
  getScoreTierClass,
  getStakeToneClass,
  type ParticipantTableRow,
} from "@/features/vmax/vmax-model";

type ParticipantsTableProps = {
  rows: ParticipantTableRow[];
  selectedNumber: number | null;
};

function buildSparklinePoints(musique?: string | null) {
  const points = parseFavoriteForm(musique);
  const width = 92;
  const height = 30;
  const polyline = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - (point.score / 100) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return { width, height, polyline };
}

export default function ParticipantsTable({ rows, selectedNumber }: ParticipantsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#101827] shadow-2xl shadow-black/20">
      <table className="w-full min-w-[58rem] border-collapse">
        <thead>
          <tr className="text-left text-[0.72rem] uppercase text-slate-400">
            <th className="px-4 py-3 font-black">#</th>
            <th className="px-4 py-3 font-black">Cheval</th>
            <th className="px-4 py-3 font-black">Jockey</th>
            <th className="px-4 py-3 font-black">Entraîneur</th>
            <th className="px-4 py-3 font-black">Cote PMU</th>
            <th className="px-4 py-3 font-black">Score IA</th>
            <th className="px-4 py-3 font-black">Forme</th>
            <th className="px-4 py-3 text-center font-black">Mise</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selectedNumber !== null && row.numero === selectedNumber;
            const formLine = buildSparklinePoints(row.musique);

            return (
              <tr
                key={row.numero}
                className={`border-t border-white/10 transition-colors hover:bg-white/[0.035] ${
                  isSelected ? "bg-[#D4AF37]/10 shadow-[inset_3px_0_0_#D4AF37]" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <span
                    className={`grid aspect-square w-9 place-items-center rounded-full font-[var(--font-display)] text-lg font-black ${getRunnerNumberClass(row.numero)}`}
                  >
                    {row.numero}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <strong className="block font-black text-[#F6F2E8]">{row.cheval}</strong>
                  {isSelected ? (
                    <span className="mt-1 block text-[0.7rem] font-black uppercase text-[#D4AF37]">
                      Sélection IA #1
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-slate-300">{row.jockey}</td>
                <td className="px-4 py-3 text-sm font-bold text-slate-300">{row.entraineur}</td>
                <td className="px-4 py-3 font-[var(--font-display)] text-base font-black text-[#D4AF37]">
                  {formatOdds(row.cote)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex min-w-24 flex-col items-center justify-center rounded-lg border px-3 py-1 font-[var(--font-display)] text-base font-black leading-none ${getScoreTierClass(row.scoreIa)}`}
                  >
                    <span>
                      {typeof row.scoreIa === "number" && Number.isFinite(row.scoreIa)
                        ? Math.round(row.scoreIa)
                        : "--"}
                    </span>
                    <small className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.08em]">
                      {getScoreBadgeLabel(row.scoreIa)}
                    </small>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <svg
                    className="h-8 w-24"
                    viewBox={`0 0 ${formLine.width} ${formLine.height}`}
                    aria-label="Forme des cinq dernières courses"
                  >
                    <polyline
                      points={formLine.polyline}
                      fill="none"
                      stroke="#00C851"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                    />
                  </svg>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex min-w-28 justify-center rounded-lg px-3 py-2 text-sm font-black ${getStakeToneClass(row.mise)}`}
                    title="Basé sur bankroll de 100€ et Kelly 25%"
                  >
                    {row.mise === null ? formatStakeLabel(row.mise) : formatStakeEuro(row.mise)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
