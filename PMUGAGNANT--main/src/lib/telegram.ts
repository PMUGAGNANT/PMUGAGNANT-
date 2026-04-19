import type { WeeklyReportRow } from "@/lib/types";
import type { MeteoData } from "@/lib/meteo";
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

function getTelegramPrivateGroupConfig() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN,
    privateChatId:
      process.env.TELEGRAM_PRIVATE_CHAT_ID ?? process.env.TELEGRAM_PRO_CHAT_ID,
    fallbackInviteLink:
      process.env.TELEGRAM_PRIVATE_INVITE_LINK ?? process.env.TELEGRAM_PRO_INVITE_LINK,
  };
}

function isInviteResponse(
  value: unknown
): value is { ok: boolean; result?: { invite_link?: string }; description?: string } {
  return typeof value === "object" && value !== null && "ok" in value;
}

export function isTelegramConfigured() {
  const { token, chatId } = getTelegramConfig();
  return Boolean(token && chatId);
}

export function isTelegramPrivateGroupConfigured() {
  const { token, privateChatId, fallbackInviteLink } = getTelegramPrivateGroupConfig();
  return Boolean(fallbackInviteLink || (token && privateChatId));
}

export async function createPrivateTelegramInviteLink(context: {
  userId: string;
  email?: string | null;
}) {
  const { token, privateChatId, fallbackInviteLink } = getTelegramPrivateGroupConfig();
  if (!token || !privateChatId) {
    return fallbackInviteLink ?? null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    const response = await fetch(`${TELEGRAM_ENDPOINT}/bot${token}/createChatInviteLink`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: privateChatId,
        name: `PMU PRO ${context.userId.slice(0, 8)}`,
        member_limit: 1,
      }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as unknown;
    if (!response.ok || !isInviteResponse(payload) || payload.ok !== true) {
      const description =
        isInviteResponse(payload) && typeof payload.description === "string"
          ? payload.description
          : `status ${response.status}`;
      throw new Error(`Telegram private invite failed: ${description}`);
    }

    const inviteLink = payload.result?.invite_link;
    if (typeof inviteLink === "string" && inviteLink.trim() !== "") {
      return inviteLink;
    }

    throw new Error("Telegram private invite failed: missing invite_link");
  } catch (error) {
    logger.error("telegram.private_invite_failed", error, {
      userId: context.userId,
      email: context.email ?? null,
    });
    if (fallbackInviteLink) {
      return fallbackInviteLink;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendTelegramMessage(text: string) {
  const { token, chatId } = getTelegramConfig();
  if (!token || !chatId) {
    return { sent: false, skipped: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  const safeText = text.length > MAX_TELEGRAM_MESSAGE_LENGTH
    ? `${text.slice(0, MAX_TELEGRAM_MESSAGE_LENGTH - 12)}\n\n[message coupé]`
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
  const header = [`PMU Gagnant`, `Analyse du matin ${date}`];
  if (rows.length === 0) {
    return [...header, "Aucun ticket validé ce matin."].join("\n");
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
  const header = [`PMU Gagnant`, `Mise à jour T-10 ${date}`];
  if (rows.length === 0) {
    return [...header, "Aucun signal T-10 notable."].join("\n");
  }

  const lines = rows
    .slice(0, 12)
    .map((row) => {
      const variationLabel =
        row.variation === null ? "variation n/d" : `variation ${row.variation > 0 ? "+" : ""}${row.variation}%`;
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
    "PMU Gagnant",
    `Rapport hebdo ${report.week_start} -> ${report.week_end}`,
    `ROI total : ${report.roi_total}%`,
    `Échantillon : ${report.sample_size} prédictions`,
    ...(bestPari ? [`Meilleur type de pari : ${bestPari[0]} (${bestPari[1]}%)`] : []),
  ];

  const insightLines = insights.length > 0 ? ["Points clés :", ...insights] : [];
  const adjustmentLines =
    adjustments.length > 0 ? ["Auto-ajustements :", ...adjustments] : ["Auto-ajustements : aucun"];

  return [...header, ...insightLines, ...adjustmentLines].join("\n");
}

export async function alerteTerrainChange(
  course: string,
  hippodrome: string,
  meteo: MeteoData,
  chevauxImpactes: string[]
): Promise<void> {
  if (!isTelegramConfigured()) {
    return;
  }

  const impacted =
    chevauxImpactes.length > 0
      ? chevauxImpactes.map((cheval) => `- ${cheval}`).join("\n")
      : "- Aucun cheval identifie";

  await sendTelegramMessage(
    [
      "PMU Gagnant",
      `Alerte terrain - ${course} ${hippodrome}`,
      `${meteo.description}, ${meteo.temperature}C, vent ${meteo.vent_kmh} km/h, humidite ${meteo.humidite}%`,
      meteo.alerte ?? "Terrain defavorable prevu.",
      "Chevaux a verifier :",
      impacted,
    ].join("\n")
  );
}
