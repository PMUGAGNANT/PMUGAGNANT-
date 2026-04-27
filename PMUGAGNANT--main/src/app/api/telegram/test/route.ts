import { NextRequest, NextResponse } from "next/server";
import { badRequest, serviceUnavailable, serverError } from "@/lib/api-response";
import { ensureCronAuthorized } from "@/lib/cron-auth";
import { isTelegramBotConfigured, sendTelegramMessageToChat } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chat_id");
  if (!chatId) {
    return badRequest("Parametre chat_id requis.");
  }

  if (!isTelegramBotConfigured()) {
    return serviceUnavailable("TELEGRAM_BOT_TOKEN manquant.");
  }

  try {
    const delivery = await sendTelegramMessageToChat(
      chatId,
      [
        "TurfEdge",
        "Message de test du bot @pmugagnantbot.",
        "Si vous recevez ce message, la connexion Telegram fonctionne.",
      ].join("\n")
    );

    return NextResponse.json({ success: true, chatId, delivery });
  } catch (error) {
    return serverError("Envoi Telegram de test impossible.", error, { chatId });
  }
}
