import { NextRequest, NextResponse } from "next/server";

import { serverError, serviceUnavailable, unauthorized } from "@/lib/api-response";
import { getRequestSubscriptionState } from "@/lib/subscription";
import {
  createPrivateTelegramInviteLink,
  isTelegramPrivateGroupConfigured,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { state } = await getRequestSubscriptionState(
      request.headers.get("authorization")
    );

    if (!state.authenticated || !state.user) {
      return unauthorized("Connexion requise.");
    }

    if (!state.isSubscribed) {
      return NextResponse.json(
        { success: false, error: "Abonnement PRO requis." },
        { status: 403 }
      );
    }

    if (!isTelegramPrivateGroupConfigured()) {
      return serviceUnavailable("Telegram prive non configure.");
    }

    const inviteUrl = await createPrivateTelegramInviteLink({
      userId: state.user.id,
      email: state.user.email,
    });

    if (!inviteUrl) {
      return serviceUnavailable("Invitation Telegram indisponible.");
    }

    return NextResponse.json({ success: true, inviteUrl });
  } catch (error) {
    return serverError("Invitation Telegram privee impossible.", error);
  }
}
