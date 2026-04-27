import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api-response";
import { getAuthenticatedRequestUser } from "@/lib/request-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PushPreferencesBody = {
  morningEnabled?: boolean;
  preraceEnabled?: boolean;
  resultsEnabled?: boolean;
};

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return serverError("Supabase admin indisponible pour charger les alertes.");
  }

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("morning_enabled,prerace_enabled,results_enabled")
    .eq("user_id", auth.user.id);

  if (error) {
    return serverError("Impossible de charger les preferences push.", error);
  }

  const rows = data ?? [];

  return NextResponse.json({
    success: true,
    subscribed: rows.length > 0,
    preferences: {
      morningEnabled: rows.every((row) => row.morning_enabled !== false),
      preraceEnabled: rows.every((row) => row.prerace_enabled !== false),
      resultsEnabled: rows.every((row) => row.results_enabled !== false),
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return serverError("Supabase admin indisponible pour enregistrer les alertes.");
  }

  let body: PushPreferencesBody;
  try {
    body = (await request.json()) as PushPreferencesBody;
  } catch (error) {
    return badRequest("Corps JSON invalide.", {
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const updates = {
    morning_enabled: body.morningEnabled !== false,
    prerace_enabled: body.preraceEnabled !== false,
    results_enabled: body.resultsEnabled !== false,
  };

  const { error, count } = await admin
    .from("push_subscriptions")
    .update(updates, { count: "exact" })
    .eq("user_id", auth.user.id);

  if (error) {
    return serverError("Impossible d'enregistrer les preferences push.", error);
  }

  return NextResponse.json({
    success: true,
    updated: count ?? 0,
    preferences: {
      morningEnabled: updates.morning_enabled,
      preraceEnabled: updates.prerace_enabled,
      resultsEnabled: updates.results_enabled,
    },
  });
}
