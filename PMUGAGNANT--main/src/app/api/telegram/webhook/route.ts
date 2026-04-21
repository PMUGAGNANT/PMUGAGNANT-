import { NextRequest, NextResponse } from "next/server";
import { isCronSecretCandidateValid } from "@/lib/cron-auth";
import { logger } from "@/lib/server-logger";
import { getSupabaseAdminClient, getSupabaseAdminConfigError } from "@/lib/supabase";
import { sendTelegramMessageToChat } from "@/lib/telegram";
import {
  buildTelegramHelpMessage,
  buildTelegramStartMessage,
  sendTelegramPronosticToPremiumChat,
} from "@/lib/telegram-pronostics";

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
  return process.env.TELEGRAM_WEBHOOK_SECRET ?? null;
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

async function recordSubscriptionCommand(message: TelegramMessage, command: string) {
  const chat = message.chat;
  if (!chat?.id) return;

  const { error } = await getAdmin().from("telegram_subscriptions").upsert(
    {
      chat_id: String(chat.id),
      username: message.from?.username ?? chat.username ?? null,
      first_name: message.from?.first_name ?? chat.first_name ?? null,
      last_name: message.from?.last_name ?? chat.last_name ?? null,
      last_command: command,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chat_id" }
  );

  if (error) {
    throw new Error(`Telegram subscription command update failed: ${error.message}`);
  }
}

async function handleCommand(message: TelegramMessage) {
  const chatId = message.chat?.id;
  const text = message.text?.trim() ?? "";
  if (!chatId || !text) return { handled: false };

  const command = getCommand(text);

  if (command === "/start") {
    await upsertSubscription(message, true, command);
    await sendTelegramMessageToChat(chatId, buildTelegramStartMessage(chatId));
    return { handled: true, command };
  }

  if (command === "/stop") {
    await upsertSubscription(message, false, command);
    await sendTelegramMessageToChat(chatId, "Vous avez été désinscrit ✅");
    return { handled: true, command };
  }

  if (command === "/aide") {
    await recordSubscriptionCommand(message, command);
    await sendTelegramMessageToChat(chatId, buildTelegramHelpMessage());
    return { handled: true, command };
  }

  if (command === "/pronostic") {
    await recordSubscriptionCommand(message, command);
    await sendTelegramPronosticToPremiumChat(chatId);
    return { handled: true, command };
  }

  await recordSubscriptionCommand(message, command);
  await sendTelegramMessageToChat(
    chatId,
    `Commande inconnue.\n\n${buildTelegramHelpMessage()}`
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
