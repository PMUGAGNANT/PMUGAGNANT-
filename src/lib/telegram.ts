import type { WeeklyReportRow } from "@/lib/types";
import { logger } from "@/lib/server-logger";

const TELEGRAM_ENDPOINT = "https://api.telegram.org";
const TELEGRAM_TIMEOUT_MS = 10_000;
const MAX_TELEGRAM_MESSAGE_LENGTH = 3900;

function getTelegramConfig() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  };
}

export function isTelegramConfigured() {
  const { token, chatId } = getTelegramConfig();
  return Boolean(token && chatId);
}

export async function sendTelegramMessage(text: string) {
  const { token, chatId } = getTelegramConfig();
  if (!token || !chatId) {
    return { sent: false, skipped: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  const safeText = text.length > MAX_TELEGRAM_MESSAGE_LENGTH
    ? `${text.slice(0, MAX_TELEGRAM_MESSAGE_LENGTH - 12)}\n\n[message coupe]`
    : text;

  try {
    const response = await fetch(`${TELEGRAM_ENDPOINT}/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: safeText,
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram send failed: ${response.status} ${body}`);
    }

    return { sent: true };
  } catch (error) {
    logger.error("telegram.send_failed", error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function formatMorningTelegram(
  date: string,
  rows: Array<{
    reunion: number;
    course: number;
    hippodrome: string;
    chevalNum: number;
    chevalNom: string;
    confiance: number;
    decision: string;
  }>
) {
  const header = [`PMU AI v9.2`, `Analyse matinale ${date}`];
  if (rows.length === 0) {
    return [...header, "Aucun pari valide ce matin."].join("\n");
  }

  const lines = rows
    .slice(0, 10)
    .map(
      (row) =>
        `R${row.reunion}C${row.course} ${row.hippodrome}: #${row.chevalNum} ${row.chevalNom} (${row.decision}, confiance ${row.confiance}/10)`
    );

  return [...header, ...lines].join("\n");
}

export function formatPreRaceTelegram(
  date: string,
  rows: Array<{
    reunion: number;
    course: number;
    chevalNum: number;
    chevalNom: string;
    variation: number | null;
    decision: string;
    confiance: number;
    extra: string[];
  }>
) {
  const header = [`PMU AI v9.2`, `Mise a jour T-10 ${date}`];
  if (rows.length === 0) {
    return [...header, "Aucun signal T-10 notable."].join("\n");
  }

  const lines = rows
    .slice(0, 12)
    .map((row) => {
      const variationLabel =
        row.variation === null ? "var n/a" : `var ${row.variation > 0 ? "+" : ""}${row.variation}%`;
      const details = row.extra.length > 0 ? ` - ${row.extra.join(", ")}` : "";
      return `R${row.reunion}C${row.course} #${row.chevalNum} ${row.chevalNom}: ${row.decision}, confiance ${row.confiance}/10, ${variationLabel}${details}`;
    });

  return [...header, ...lines].join("\n");
}

export function formatWeeklyTelegram(
  report: WeeklyReportRow,
  insights: string[],
  adjustments: string[]
) {
  const bestPari = Object.entries(report.roi_by_pari ?? {})
    .sort((left, right) => right[1] - left[1])[0] ?? null;
  const header = [
    "PMU AI v9.2",
    `Rapport hebdo ${report.week_start} -> ${report.week_end}`,
    `ROI total: ${report.roi_total}%`,
    `Echantillon: ${report.sample_size} predictions`,
    ...(bestPari ? [`Meilleur type de pari: ${bestPari[0]} (${bestPari[1]}%)`] : []),
  ];

  const insightLines = insights.length > 0 ? ["Insights:", ...insights] : [];
  const adjustmentLines =
    adjustments.length > 0 ? ["Auto-ajustements:", ...adjustments] : ["Auto-ajustements: aucun"];

  return [...header, ...insightLines, ...adjustmentLines].join("\n");
}
