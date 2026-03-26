import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseRequestClient,
  getSupabaseConfigError,
} from "@/lib/supabase";
import { badRequest, serverError, unauthorized } from "@/lib/api-response";
import {
  getBearerToken,
  isValidPmuDate,
  parseOptionalFiniteNumber,
  parsePositiveInteger,
} from "@/lib/request-utils";
import { logger } from "@/lib/server-logger";

function getSupabaseClient(req: NextRequest) {
  const token = getBearerToken(req.headers.get("authorization"));
  return createSupabaseRequestClient(token);
}

function normalizeBetPayload(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const payload = body as Record<string, unknown>;
  const dateStr = typeof payload.date_str === "string" ? payload.date_str.trim() : "";
  const reunion = parsePositiveInteger(String(payload.reunion ?? ""));
  const course = parsePositiveInteger(String(payload.course ?? ""));
  const chevalNum = parsePositiveInteger(String(payload.cheval_num ?? ""));
  const mise = parseOptionalFiniteNumber(payload.mise);
  const cote = parseOptionalFiniteNumber(payload.cote);
  const chevalNom = typeof payload.cheval_nom === "string" ? payload.cheval_nom.trim() : "";
  const typePari = typeof payload.type_pari === "string" ? payload.type_pari.trim().toUpperCase() : "";

  return {
    date_str: dateStr,
    reunion,
    course,
    hippodrome: typeof payload.hippodrome === "string" ? payload.hippodrome.trim() : "",
    heure_depart: typeof payload.heure_depart === "string" ? payload.heure_depart.trim() : "",
    cheval_num: chevalNum,
    cheval_nom: chevalNom,
    type_pari: typePari,
    mise,
    cote,
  };
}

async function getAuthenticatedUserClient(req: NextRequest) {
  const client = getSupabaseClient(req);
  if (!client) {
    return { errorResponse: serverError(getSupabaseConfigError()) };
  }

  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    return { errorResponse: serverError("Authentication failed", error) };
  }

  if (!user) {
    return { errorResponse: unauthorized("Non connecte") };
  }

  return { client, user };
}

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedUserClient(req);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const { client, user } = auth;
  const { data: bets, error } = await client
    .from("bets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return serverError("Failed to list bets", error, { userId: user.id });
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("solde,is_subscribed,subscription_status,stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (profileError) {
    logger.warn("bets.profile_fetch_failed", {
      userId: user.id,
      error: profileError.message,
    });
  }

  return NextResponse.json({
    success: true,
    bets: bets ?? [],
    solde: profile?.solde ?? 1000,
    isSubscribed: Boolean(profile?.is_subscribed),
    subscriptionStatus: profile?.subscription_status ?? "FREE",
    stripeCustomerId: profile?.stripe_customer_id ?? null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedUserClient(req);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const { client, user } = auth;
  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    return badRequest("Invalid JSON payload", {
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const payload = normalizeBetPayload(body);
  if (!payload) {
    return badRequest("Invalid payload");
  }

  const { date_str, reunion, course, hippodrome, heure_depart, cheval_num, cheval_nom, type_pari, mise, cote } = payload;

  if (!date_str || !reunion || !course || !cheval_num || !cheval_nom || !type_pari || mise === null || cote === null) {
    return badRequest("Donnees manquantes");
  }

  if (!isValidPmuDate(date_str)) {
    return badRequest("Format de date invalide. Attendu: DDMMYYYY");
  }

  if (mise < 1 || mise > 50) {
    return badRequest("Mise entre 1 et 50");
  }

  if (cote <= 1 || cote > 200) {
    return badRequest("Cote invalide");
  }

  if (!["GAGNANT", "PLACE"].includes(type_pari)) {
    return badRequest("Type de pari invalide");
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("solde")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return serverError("Failed to fetch profile balance", profileError, { userId: user.id });
  }

  const solde = profile?.solde ?? 1000;
  if (solde < mise) {
    return badRequest("Solde insuffisant");
  }

  const { data: existing, error: duplicateCheckError } = await client
    .from("bets")
    .select("id")
    .eq("user_id", user.id)
    .eq("date_str", date_str)
    .eq("reunion", reunion)
    .eq("course", course)
    .limit(1);

  if (duplicateCheckError) {
    return serverError("Failed to check duplicate bet", duplicateCheckError, { userId: user.id, date_str, reunion, course });
  }

  if (existing && existing.length > 0) {
    return badRequest("Vous avez deja parie sur cette course");
  }

  const { data: insertedBet, error: betError } = await client
    .from("bets")
    .insert({
      user_id: user.id,
      date_str,
      reunion,
      course,
      hippodrome,
      heure_depart,
      cheval_num,
      cheval_nom,
      type_pari,
      mise,
      cote,
      statut: "EN_ATTENTE",
      gain: null,
    })
    .select("id")
    .single();

  if (betError) {
    return serverError("Bet insert failed", betError, { userId: user.id, date_str, reunion, course });
  }

  const { error: profileUpdateError } = await client
    .from("profiles")
    .update({ solde: solde - mise })
    .eq("id", user.id);

  if (profileUpdateError) {
    logger.error("bets.profile_update_failed", profileUpdateError, { userId: user.id, betId: insertedBet?.id });
    if (insertedBet?.id) {
      await client.from("bets").delete().eq("id", insertedBet.id);
    }

    return serverError("Profile update failed", profileUpdateError, { userId: user.id });
  }

  return NextResponse.json({
    success: true,
    solde: solde - mise,
  });
}
