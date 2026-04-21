import { getTodayDateStr } from "@/lib/date-utils";
import {
  getPredictionOdds,
  getSelectedPredictions,
} from "@/lib/public-performance";
import { listPredictionsByDate } from "@/lib/prediction-store";
import { logger } from "@/lib/server-logger";
import { getSupabaseAdminClient, getSupabaseAdminConfigError } from "@/lib/supabase";
import { isActiveSubscriptionStatus } from "@/lib/subscription";
import { sendTelegramMessageToChat } from "@/lib/telegram";

export const TELEGRAM_PREMIUM_LOCK_MESSAGE =
  "Fonctionnalité réservée aux membres Premium 👑 Abonnez-vous sur https://pmugagnant.vercel.app/premium";

const PROFILE_URL = "https://pmugagnant.vercel.app/mes-paris";

type TelegramProfileRow = {
  id: string;
  telegram_chat_id: string | null;
  is_subscribed: boolean | null;
  subscription_status: string | null;
};

type TelegramSubscriptionRow = {
  chat_id: string;
};

function getAdmin() {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error(getSupabaseAdminConfigError());
  }

  return admin;
}

function isPremiumStripeProfile(profile: Pick<TelegramProfileRow, "is_subscribed" | "subscription_status"> | null | undefined) {
  return Boolean(profile?.is_subscribed) || isActiveSubscriptionStatus(profile?.subscription_status);
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value.toFixed(2)} EUR`;
}

function formatOdds(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return value.toFixed(1);
}

function normalizeBetType(value: string | null | undefined) {
  const normalized = value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();

  if (normalized?.includes("GAGNANT")) return "GAGNANT";
  if (normalized?.includes("PLACE")) return "PLACE";
  return null;
}

function formatBetType(value: string | null | undefined) {
  return normalizeBetType(value) ?? "PLACE";
}

function formatBetLine(value: string | null | undefined) {
  const betType = formatBetType(value);
  return betType === "GAGNANT"
    ? "🔥 Pari conseillé : GAGNANT"
    : "🟢 Pari conseillé : PLACE";
}

function formatConfidence(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${Math.round(value)}%`;
}

function formatDecisionLine(value: string | null | undefined) {
  if (value === "VALIDE") return "✅ Décision : VALIDE";
  if (value === "SURVEILLANCE") return "🟠 Décision : SURVEILLER";
  return `⚪ Décision : ${value ?? "A PRECISER"}`;
}

function formatRiskLine(confidence: number | null | undefined, odds: number | null | undefined) {
  const safeConfidence = typeof confidence === "number" && Number.isFinite(confidence) ? confidence : 0;
  const safeOdds = typeof odds === "number" && Number.isFinite(odds) ? odds : 0;

  if (safeConfidence >= 70 && safeOdds > 0 && safeOdds <= 6) return "🟢 Risque : maîtrisé";
  if (safeConfidence >= 55) return "🟠 Risque : moyen";
  return "🔴 Risque : élevé";
}

function formatWhyLine(confidence: number | null | undefined, value: number | null | undefined) {
  const confidenceLabel = formatConfidence(confidence);
  const valueLabel = typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)} pts` : "n/d";
  return `💡 Pourquoi : confiance ${confidenceLabel}, value ${valueLabel}`;
}

function formatPlanLine(betType: string, stake: number | null | undefined) {
  return `🧾 Plan : jouer ${betType} / mise ${formatCurrency(stake)}`;
}

export function buildTelegramStartMessage(chatId: string | number) {
  return [
    "Bienvenue sur PMU Gagnant 🏇",
    "",
    `Ton ID Telegram : ${chatId}`,
    "",
    "Pour recevoir les pronostics Premium, va dans ton profil sur le site et lie ce compte Telegram :",
    PROFILE_URL,
    "",
    "Commandes disponibles :",
    "/pronostic - recevoir les sélections du jour",
    "/aide - voir l'aide",
    "/stop - arrêter les alertes",
  ].join("\n");
}

export function buildTelegramHelpMessage() {
  return [
    "PMU Gagnant - commandes Telegram",
    "",
    "/start - activer le bot et afficher ton ID Telegram",
    "/pronostic - recevoir les pronostics Premium du jour",
    "/stop - te désinscrire des alertes automatiques",
    "/aide - afficher cette aide",
    "",
    `Profil : ${PROFILE_URL}`,
  ].join("\n");
}

export async function getTelegramPremiumAccess(chatId: string | number) {
  const { data, error } = await getAdmin()
    .from("profiles")
    .select("id,telegram_chat_id,is_subscribed,subscription_status")
    .eq("telegram_chat_id", String(chatId))
    .maybeSingle();

  if (error) {
    throw new Error(`Telegram premium profile fetch failed: ${error.message}`);
  }

  const profile = data as TelegramProfileRow | null;
  return {
    linked: Boolean(profile),
    profileId: profile?.id ?? null,
    isPremium: isPremiumStripeProfile(profile),
  };
}

export async function buildTelegramPronosticMessage(date = getTodayDateStr()) {
  const rows = await listPredictionsByDate(date);
  const selections = getSelectedPredictions(rows).slice(0, 8);

  if (selections.length === 0) {
    return [
      "PMU Gagnant",
      `Pronostics du jour ${date}`,
      "",
      "Aucune sélection disponible pour le moment.",
    ].join("\n");
  }

  const lines = selections.flatMap((row, index) => {
    const raceName = `R${row.reunion}C${row.course} ${row.hippodrome}`.trim();
    const horse = `#${row.cheval_num} ${row.cheval_nom}`;
    const betType = formatBetType(row.pari_conseille);
    const odds = getPredictionOdds(row);
    return [
      `${index === 0 ? "⭐" : "🏇"} ${raceName.toUpperCase()}`,
      `🐎 ${horse}`,
      formatBetLine(betType),
      formatDecisionLine(row.decision),
      `📊 Cote : ${formatOdds(odds)} · Confiance : ${formatConfidence(row.confiance)}`,
      formatRiskLine(row.confiance, odds),
      formatWhyLine(row.confiance, row.value),
      formatPlanLine(betType, row.mise_simulee),
      "━━━━━━━━━━━━━━",
    ];
  });

  return [
    "🏆 PMU Gagnant",
    `🎯 Pronostics du jour ${date}`,
    "Canal Premium · tickets propres et actionnables",
    "━━━━━━━━━━━━━━",
    ...lines,
    "Bonne chance, joue proprement.",
  ].join("\n");
}

export async function getPremiumTelegramChatIds() {
  const admin = getAdmin();
  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("telegram_subscriptions")
    .select("chat_id")
    .eq("is_active", true);

  if (subscriptionsError) {
    throw new Error(`Telegram subscriptions fetch failed: ${subscriptionsError.message}`);
  }

  const chatIds = [
    ...new Set(
      ((subscriptions ?? []) as TelegramSubscriptionRow[])
        .map((row) => row.chat_id)
        .filter((chatId) => typeof chatId === "string" && chatId.trim() !== "")
    ),
  ];

  if (chatIds.length === 0) {
    return [] as string[];
  }

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id,telegram_chat_id,is_subscribed,subscription_status")
    .in("telegram_chat_id", chatIds);

  if (profilesError) {
    throw new Error(`Telegram premium recipients fetch failed: ${profilesError.message}`);
  }

  return [
    ...new Set(
      ((profiles ?? []) as TelegramProfileRow[])
        .filter(isPremiumStripeProfile)
        .map((profile) => profile.telegram_chat_id)
        .filter((chatId): chatId is string => Boolean(chatId))
    ),
  ];
}

export async function sendTelegramMessageToPremiumChats(message: string) {
  const chatIds = await getPremiumTelegramChatIds();
  let sent = 0;
  let failed = 0;

  for (const chatId of chatIds) {
    try {
      await sendTelegramMessageToChat(chatId, message);
      sent += 1;
    } catch (error) {
      failed += 1;
      logger.error("telegram.premium_message_failed", error, { chatId });
    }
  }

  return {
    activePremiumRecipients: chatIds.length,
    sent,
    failed,
    skipped: chatIds.length === 0,
  };
}

export async function sendTelegramPronosticToPremiumChat(chatId: string | number) {
  const access = await getTelegramPremiumAccess(chatId);
  if (!access.isPremium) {
    await sendTelegramMessageToChat(chatId, TELEGRAM_PREMIUM_LOCK_MESSAGE);
    return { sent: false, skipped: true, reason: access.linked ? "not_premium" : "not_linked" };
  }

  const message = await buildTelegramPronosticMessage();
  await sendTelegramMessageToChat(chatId, message);
  return { sent: true, skipped: false };
}

export async function sendMorningTelegramPronostics(date = getTodayDateStr()) {
  const message = await buildTelegramPronosticMessage(date);
  const delivery = await sendTelegramMessageToPremiumChats(message);

  return {
    date,
    premiumRecipients: delivery.activePremiumRecipients,
    sent: delivery.sent,
    failed: delivery.failed,
    skipped: delivery.skipped,
  };
}
