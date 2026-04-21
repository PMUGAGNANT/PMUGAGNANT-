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
import {
  buildSubscriptionStateFromProfile,
  PROFILE_SUBSCRIPTION_SELECT,
  type SubscriptionProfileSnapshot,
} from "@/lib/subscription";

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
    return { errorResponse: serverError("Échec de l'authentification.", error) };
  }

  if (!user) {
    return { errorResponse: unauthorized("Non connecté.") };
  }

  return { client, user };
}

type BetPlacementResult = {
  bet_id: string;
  solde: number;
};

function mapBetPlacementError(error: { message?: string } | null) {
  const message = error?.message ?? "";

  switch (message) {
    case "AUTH_REQUIRED":
      return unauthorized("Connexion requise.");
    case "INVALID_DATE":
      return badRequest("Format de date invalide. Attendu : DDMMYYYY.");
    case "INVALID_REUNION":
    case "INVALID_COURSE":
    case "INVALID_HORSE":
      return badRequest("Identifiant de course invalide.");
    case "INVALID_HORSE_NAME":
      return badRequest("Nom de cheval invalide.");
    case "INVALID_BET_TYPE":
      return badRequest("Type de pari invalide.");
    case "INVALID_STAKE":
      return badRequest("La mise doit être comprise entre 1 et 50.");
    case "INVALID_ODDS":
      return badRequest("Cote invalide.");
    case "INSUFFICIENT_FUNDS":
      return badRequest("Solde insuffisant.");
    case "BET_ALREADY_EXISTS":
      return badRequest("Vous avez déjà parié sur cette course.");
    case "PROFILE_NOT_FOUND":
      return badRequest("Profil introuvable.");
    default:
      break;
  }

  return serverError("Échec de création du pari.", error ?? undefined);
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
    return serverError("Impossible de lister les paris.", error, { userId: user.id });
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select(`solde,telegram_chat_id,${PROFILE_SUBSCRIPTION_SELECT}`)
    .eq("id", user.id)
    .single();

  if (profileError) {
    logger.warn("bets.profile_fetch_failed", {
      userId: user.id,
      error: profileError.message,
    });
  }

  const subscriptionState = buildSubscriptionStateFromProfile(
    profile as SubscriptionProfileSnapshot | null | undefined,
    user
  );

  return NextResponse.json({
    success: true,
    bets: bets ?? [],
    solde: profile?.solde ?? 1000,
    isSubscribed: subscriptionState.isSubscribed,
    isStripeSubscribed: subscriptionState.isStripeSubscribed,
    accessSource: subscriptionState.accessSource,
    subscriptionStatus: subscriptionState.subscriptionStatus,
    stripeCustomerId: subscriptionState.stripeCustomerId,
    premiumAccessExpiresAt: subscriptionState.premiumAccessExpiresAt,
    telegramChatId:
      typeof profile?.telegram_chat_id === "string" ? profile.telegram_chat_id : null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedUserClient(req);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const { client } = auth;
  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    return badRequest("Corps JSON invalide.", {
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const payload = normalizeBetPayload(body);
  if (!payload) {
    return badRequest("Données de pari invalides.");
  }

  const { date_str, reunion, course, hippodrome, heure_depart, cheval_num, cheval_nom, type_pari, mise, cote } = payload;

  if (!date_str || !reunion || !course || !cheval_num || !cheval_nom || !type_pari || mise === null || cote === null) {
    return badRequest("Données manquantes.");
  }

  if (!isValidPmuDate(date_str)) {
    return badRequest("Format de date invalide. Attendu : DDMMYYYY.");
  }

  if (!Number.isInteger(mise) || mise < 1 || mise > 50) {
    return badRequest("La mise doit être comprise entre 1 et 50.");
  }

  if (cote <= 1 || cote > 200) {
    return badRequest("Cote invalide.");
  }

  if (!["GAGNANT", "PLACE"].includes(type_pari)) {
    return badRequest("Type de pari invalide.");
  }

  const { data, error } = await client.rpc("place_user_bet", {
    p_date_str: date_str,
    p_reunion: reunion,
    p_course: course,
    p_hippodrome: hippodrome,
    p_heure_depart: heure_depart,
    p_cheval_num: cheval_num,
    p_cheval_nom: cheval_nom,
    p_type_pari: type_pari,
    p_mise: mise,
    p_cote: cote,
  });

  if (error) {
    logger.warn("bets.place_failed", {
      date_str,
      reunion,
      course,
      error: error.message,
    });
    return mapBetPlacementError(error);
  }

  const placement =
    data && typeof data === "object" ? (data as unknown as BetPlacementResult) : null;
  if (!placement || typeof placement.solde !== "number") {
    return serverError("Réponse de placement invalide.");
  }

  return NextResponse.json({
    success: true,
    solde: placement.solde,
  });
}
