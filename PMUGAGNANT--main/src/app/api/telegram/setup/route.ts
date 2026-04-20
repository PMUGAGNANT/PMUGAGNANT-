import { NextRequest, NextResponse } from "next/server";
import { ensureCronAuthorized } from "@/lib/cron-auth";
import { serviceUnavailable, serverError } from "@/lib/api-response";
import { isTelegramBotConfigured, setTelegramWebhook } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const WEBHOOK_URL = "https://pmugagnant.vercel.app/api/telegram/webhook";

export async function GET(request: NextRequest) {
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) return unauthorized;

  if (!isTelegramBotConfigured()) {
    return serviceUnavailable("TELEGRAM_BOT_TOKEN manquant.");
  }

  try {
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET ?? process.env.CRON_SECRET ?? null;
    const result = await setTelegramWebhook({
      webhookUrl: WEBHOOK_URL,
      secretToken,
    });

    return NextResponse.json({
      success: true,
      webhookUrl: WEBHOOK_URL,
      telegram: result,
    });
  } catch (error) {
    return serverError("Configuration du webhook Telegram impossible.", error);
  }
}
