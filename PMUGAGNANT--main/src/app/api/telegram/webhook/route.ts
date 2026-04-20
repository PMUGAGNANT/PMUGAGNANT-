import { NextRequest, NextResponse } from "next/server";
import { isCronSecretCandidateValid } from "@/lib/cron-auth";
import { getTodayDateStr } from "@/lib/date-utils";
import {
  getPredictionOdds,
  getPredictionScore,
  getSelectedPredictions,
} from "@/lib/public-performance";
import { listPredictionsByDate } from "@/lib/prediction-store";
import { logger } from "@/lib/server-logger";
import { getSupabaseAdminClient, getSupabaseAdminConfigError } from "@/lib/supabase";
import { sendTelegramMessageToChat } from "@/lib/telegram";

export const dynamic = "force-dynamic";

type TelegramUser = {
  id?: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramChat = {
  id: number;
  type?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramMessage = {
  message_id?: number;
  from?: TelegramUser;
  chat?: TelegramChat;
  text?: string;
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
};

function getWebhookSecret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET ?? process.env.CRON_SECRET ?? null;
}

function isWebhookAuthorized(request: NextRequest) {
  const secret = getWebhookSecret();
  if (!secret) return true;

  return isCronSecretCandidateValid(secret, [
    request.headers.get("x-telegram-bot-api-secret-token"),
  ]);
}

function getCommand(text: string) {
  return text.trim().split(/\s+/)[0]?.toLowerCase().split("@")[0] ?? "";
}

function getAdmin() {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error(getSupabaseAdminConfigError());
  }

  return admin;
}

async function upsertSubscription(message: TelegramMessage, active: boolean, command: string) {
  const chat = message.chat;
  if (!chat?.id) return;

  const now = new Date().toISOString();
  const { error } = await getAdmin().from("telegram_subscriptions").upsert(
    {
      chat_id: String(chat.id),
      username: message.from?.username ?? chat.username ?? null,
      first_name: message.from?.first_name ?? chat.first_name ?? null,
      last_name: message.from?.last_name ?? chat.last_name ?? null,
      is_active: active,
      stopped_at: active ? null : now,
      last_command: command,
      updated_at: now,
    },
    { onConflict: "chat_id" }
  );

  if (error) {
    throw new Error(`Telegram subscription upsert failed: ${error.message}`);
  }
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value.toFixed(2)} EUR`;
}

function formatOdds(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return value.toFixed(1);
}

async function buildPronosticMessage() {
  const date = getTodayDateStr();
  const rows = await listPredictionsByDate(date);
  const selections = getSelectedPredictions(rows).slice(0, 6);

  if (selections.length === 0) {
    return [
      "PMU Gagnant",
      `Pronostics du jour ${date}`,
      "",
      "Aucune selection disponible pour le moment.",
    ].join("\n");
  }

  const lines = selections.flatMap((row, index) => [
    `${index + 1}. R${row.reunion}C${row.course} - ${row.hippodrome}`,
    `#${row.cheval_num} ${row.cheval_nom}`,
    `Decision: ${row.decision} - Pari: ${row.pari_conseille ?? "--"}`,
    `Confiance: ${Math.round(getPredictionScore(row))}/100 - Cote: ${formatOdds(getPredictionOdds(row))} - Mise: ${formatCurrency(row.mise_simulee)}`,
    "",
  ]);

  return ["PMU Gagnant", `Pronostics du jour ${date}`, "", ...lines].join("\n").trim();
}

async function handleCommand(message: TelegramMessage) {
  const chatId = message.chat?.id;
  const text = message.text?.trim() ?? "";
  if (!chatId || !text) return { handled: false };

  const command = getCommand(text);

  if (command === "/start") {
    await upsertSubscription(message, true, command);
    await sendTelegramMessageToChat(
      chatId,
      [
        "Bienvenue sur PMU Gagnant.",
        "",
        "Commandes disponibles :",
        "/pronostic - recevoir les selections du jour",
        "/stop - desactiver les messages du bot",
      ].join("\n")
    );
    return { handled: true, command };
  }

  if (command === "/stop") {
    await upsertSubscription(message, false, command);
    await sendTelegramMessageToChat(
      chatId,
      "Votre abonnement Telegram PMU Gagnant est desactive. Envoyez /start pour le reactiver."
    );
    return { handled: true, command };
  }

  if (command === "/pronostic") {
    const pronostic = await buildPronosticMessage();
    await sendTelegramMessageToChat(chatId, pronostic);
    return { handled: true, command };
  }

  await sendTelegramMessageToChat(
    chatId,
    "Commande inconnue. Envoyez /pronostic pour les selections du jour ou /stop pour arreter."
  );
  return { handled: true, command };
}

export async function POST(request: NextRequest) {
  if (!isWebhookAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized Telegram webhook." }, { status: 401 });
  }

  try {
    const update = (await request.json()) as TelegramUpdate;
    const result = update.message ? await handleCommand(update.message) : { handled: false };

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error("telegram.webhook_failed", error);
    return NextResponse.json({ success: false, error: "Telegram webhook failed." }, { status: 500 });
  }
}
