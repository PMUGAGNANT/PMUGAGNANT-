import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError, unauthorized } from "@/lib/api-response";
import { getBearerToken } from "@/lib/request-utils";
import {
  createSupabaseRequestClient,
  getSupabaseAdminClient,
  getSupabaseAdminConfigError,
  getSupabaseConfigError,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

function normalizeChatId(value: unknown) {
  const chatId = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!/^-?\d{5,20}$/.test(chatId)) {
    return null;
  }

  return chatId;
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request.headers.get("authorization"));
  const client = createSupabaseRequestClient(token);
  if (!client) {
    return serverError(getSupabaseConfigError());
  }

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError) {
    return serverError("Échec de l'authentification.", authError);
  }

  if (!user) {
    return unauthorized("Connexion requise.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Corps JSON invalide.");
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const chatId = normalizeChatId(payload.chat_id ?? payload.chatId);
  if (!chatId) {
    return badRequest("chat_id Telegram invalide.");
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return serverError(getSupabaseAdminConfigError());
  }

  const { data: subscription, error: subscriptionError } = await admin
    .from("telegram_subscriptions")
    .select("chat_id")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (subscriptionError) {
    return serverError("Vérification Telegram impossible.", subscriptionError);
  }

  if (!subscription) {
    return badRequest("Envoie d'abord /start au bot Telegram, puis colle l'ID affiche.");
  }

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (existingProfileError) {
    return serverError("Vérification du compte Telegram impossible.", existingProfileError);
  }

  if (existingProfile && existingProfile.id !== user.id) {
    return badRequest("Ce compte Telegram est déjà lié à un autre profil.");
  }

  const { error } = await admin
    .from("profiles")
    .update({ telegram_chat_id: chatId })
    .eq("id", user.id);

  if (error) {
    return serverError("Liaison Telegram impossible.", error, { userId: user.id });
  }

  return NextResponse.json({ success: true, telegramChatId: chatId });
}
