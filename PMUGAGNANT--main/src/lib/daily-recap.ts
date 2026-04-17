import { fromIsoDate, toIsoDate } from "@/lib/date-utils";
import { listPredictionsBetween } from "@/lib/prediction-store";
import { isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram";
import type { PredictionRow } from "@/lib/types";

export interface DailyRecapSummary {
  success: true;
  date: string;
  isoDate: string;
  settledPredictions: number;
  playedPredictions: number;
  wins: number;
  places: number;
  losses: number;
  totalStake: number;
  totalGain: number;
  netGain: number;
  roi: number;
  hitRate: number;
  bestTickets: Array<{
    raceLabel: string;
    hippodrome: string;
    cheval: string;
    betType: "GAGNANT" | "PLACE" | null;
    stake: number;
    gain: number;
    netGain: number;
  }>;
  telegram: {
    configured: boolean;
    sent: boolean;
    skipped: boolean;
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function getStake(row: PredictionRow) {
  return Math.max(0, Number(row.mise_simulee ?? 0));
}

function getGain(row: PredictionRow) {
  return Math.max(0, Number(row.gain_simule ?? 0));
}

function isSettled(row: PredictionRow) {
  return row.stage === "RESULTAT" && row.gain_simule !== null;
}

function isPlayed(row: PredictionRow) {
  return row.decision !== "REJET" && getStake(row) > 0 && isSettled(row);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatSignedCurrency(value: number) {
  return `${value > 0 ? "+" : ""}${formatCurrency(value)}`;
}

export function buildDailyRecapSummary(
  rows: PredictionRow[],
  isoDate: string,
  telegram: DailyRecapSummary["telegram"] = {
    configured: false,
    sent: false,
    skipped: true,
  }
): DailyRecapSummary {
  const settledRows = rows.filter(isSettled);
  const playedRows = rows.filter(isPlayed);
  const totalStake = round2(playedRows.reduce((sum, row) => sum + getStake(row), 0));
  const totalGain = round2(playedRows.reduce((sum, row) => sum + getGain(row), 0));
  const netGain = round2(totalGain - totalStake);
  const wins = playedRows.filter((row) => row.resultat_gagnant === true).length;
  const places = playedRows.filter((row) => row.resultat_place === true && row.resultat_gagnant !== true).length;
  const losses = playedRows.filter(
    (row) => row.resultat_gagnant !== true && row.resultat_place !== true
  ).length;
  const bestTickets = playedRows
    .map((row) => {
      const stake = getStake(row);
      const gain = getGain(row);
      return {
        raceLabel: `R${row.reunion}C${row.course}`,
        hippodrome: row.hippodrome,
        cheval: `#${row.cheval_num} ${row.cheval_nom}`,
        betType: row.pari_conseille ?? null,
        stake,
        gain,
        netGain: round2(gain - stake),
      };
    })
    .sort((left, right) => right.netGain - left.netGain)
    .slice(0, 5);

  return {
    success: true,
    date: fromIsoDate(isoDate),
    isoDate,
    settledPredictions: settledRows.length,
    playedPredictions: playedRows.length,
    wins,
    places,
    losses,
    totalStake,
    totalGain,
    netGain,
    roi: totalStake > 0 ? round2((netGain / totalStake) * 100) : 0,
    hitRate: playedRows.length > 0 ? round2(((wins + places) / playedRows.length) * 100) : 0,
    bestTickets,
    telegram,
  };
}

export function formatDailyRecapTelegram(summary: DailyRecapSummary) {
  const header = [
    "PMU Gagnant",
    `Recap journalier ${summary.date}`,
    `ROI : ${formatPercent(summary.roi)}`,
    `Gain net : ${formatSignedCurrency(summary.netGain)}`,
    `Mises : ${formatCurrency(summary.totalStake)} - Gains : ${formatCurrency(summary.totalGain)}`,
    `Tickets joues : ${summary.playedPredictions} - Reussite : ${summary.hitRate.toFixed(1)}%`,
    `Gagnants : ${summary.wins} - Places : ${summary.places} - Perdus : ${summary.losses}`,
  ];

  if (summary.bestTickets.length === 0) {
    return [...header, "Aucun ticket regle sur cette date."].join("\n");
  }

  const ticketLines = summary.bestTickets.map(
    (ticket) =>
      `${ticket.raceLabel} ${ticket.hippodrome} ${ticket.cheval} ${ticket.betType ?? "PARI"}: ${formatSignedCurrency(ticket.netGain)}`
  );

  return [...header, "Meilleurs tickets :", ...ticketLines].join("\n");
}

export async function runDailyRecap(dateStr: string) {
  const isoDate = toIsoDate(dateStr);
  const rows = await listPredictionsBetween(isoDate, isoDate);
  const configured = isTelegramConfigured();
  const summary = buildDailyRecapSummary(rows, isoDate, {
    configured,
    sent: false,
    skipped: !configured,
  });

  if (!configured) {
    return summary;
  }

  const delivery = await sendTelegramMessage(formatDailyRecapTelegram(summary));
  return {
    ...summary,
    telegram: {
      configured,
      sent: delivery.sent === true,
      skipped: delivery.skipped === true,
    },
  };
}
