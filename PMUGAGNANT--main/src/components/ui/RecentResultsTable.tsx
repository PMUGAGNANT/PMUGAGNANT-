"use client";

import type { PublicResultsResult } from "@/lib/use-public-results";

type RecentResultsTableProps = {
  results: PublicResultsResult[];
  isLoading?: boolean;
};

function formatDate(value: string) {
  if (!/^\d{8}$/.test(value)) {
    return value;
  }

  return `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
}

function formatOdds(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return value.toFixed(1);
}

function getBetLabel(result: PublicResultsResult) {
  const recommendation = result.recommandation.toUpperCase();
  if (recommendation.includes("PLACE")) {
    return "PLACE";
  }
  if (recommendation.includes("GAGNANT")) {
    return "GAGNANT";
  }
  return recommendation || "—";
}

function getGainLabel(result: PublicResultsResult) {
  if (result.resultat === "PERDU") {
    return "-1u";
  }

  if (result.resultat === "GAGNANT" && typeof result.favori.cotePmu === "number") {
    return `+${Math.max(result.favori.cotePmu - 1, 0).toFixed(1)}u`;
  }

  if (result.resultat === "PLACE") {
    return "Place";
  }

  return "—";
}

export function RecentResultsTable({ results, isLoading = false }: RecentResultsTableProps) {
  if (isLoading) {
    return <div className="h-[320px] animate-pulse rounded-[24px] bg-[var(--pmu-surface-2)]" />;
  }

  if (!results.length) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-[24px] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] text-sm font-semibold text-[var(--pmu-text-soft)]">
        Données en cours de collecte
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[24px] border border-[var(--pmu-border)] bg-[var(--pmu-surface)]">
      <table className="app-table min-w-[760px]">
        <thead>
          <tr>
            <th>Date</th>
            <th>Course</th>
            <th>Cheval</th>
            <th>Pari</th>
            <th>Cote</th>
            <th>Résultat</th>
            <th>Gain</th>
          </tr>
        </thead>
        <tbody>
          {results.slice(0, 20).map((result) => {
            const positive = result.resultat === "GAGNANT" || result.resultat === "PLACE";

            return (
              <tr
                key={`${result.courseInfo.dateStr}-${result.courseInfo.reunion}-${result.courseInfo.course}-${result.favori.numPmu}`}
              >
                <td>{formatDate(result.courseInfo.dateStr)}</td>
                <td>{`R${result.courseInfo.reunion}C${result.courseInfo.course} • ${result.courseInfo.nomCourse}`}</td>
                <td>{`N°${result.favori.numPmu} ${result.favori.nom}`}</td>
                <td>{getBetLabel(result)}</td>
                <td>{formatOdds(result.favori.cotePmu ?? result.favori.coteEstimee)}</td>
                <td style={{ color: positive ? "#00FF88" : "#FF4444", fontWeight: 800 }}>
                  {result.resultat}
                </td>
                <td style={{ color: positive ? "#00FF88" : "#FF4444", fontWeight: 800 }}>
                  {getGainLabel(result)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
