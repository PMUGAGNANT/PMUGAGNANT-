import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseRequestClient,
  getSupabaseConfigError,
  getSupabaseSetupError,
  normalizeSupabaseAppError,
} from "@/lib/supabase";

function getSupabaseClient(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return createSupabaseRequestClient(token);
}

// GET /api/bets - List user bets
export async function GET(req: NextRequest) {
  const client = getSupabaseClient(req);
  if (!client) {
    return NextResponse.json({ success: false, error: getSupabaseConfigError() }, { status: 500 });
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Non connecte" }, { status: 401 });
  }

  const { data: bets, error: betsError } = await client
    .from("bets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (betsError) {
    return NextResponse.json({ success: false, error: normalizeSupabaseAppError(betsError) }, { status: 500 });
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("solde")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { success: false, error: normalizeSupabaseAppError(profileError, getSupabaseSetupError()) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    bets: bets || [],
    solde: profile.solde ?? 1000,
  });
}

// POST /api/bets - Place a bet
export async function POST(req: NextRequest) {
  const client = getSupabaseClient(req);
  if (!client) {
    return NextResponse.json({ success: false, error: getSupabaseConfigError() }, { status: 500 });
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Non connecte" }, { status: 401 });
  }

  const body = await req.json();
  const {
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
  } = body;

  if (!date_str || !reunion || !course || !cheval_num || !cheval_nom || !type_pari || !mise || !cote) {
    return NextResponse.json({ success: false, error: "Donnees manquantes" }, { status: 400 });
  }

  if (mise < 1 || mise > 50) {
    return NextResponse.json({ success: false, error: "Mise entre 1 et 50" }, { status: 400 });
  }

  if (!["GAGNANT", "PLACE"].includes(type_pari)) {
    return NextResponse.json({ success: false, error: "Type de pari invalide" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("solde")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { success: false, error: normalizeSupabaseAppError(profileError, getSupabaseSetupError()) },
      { status: 500 }
    );
  }

  const solde = profile.solde ?? 1000;
  if (solde < mise) {
    return NextResponse.json({ success: false, error: "Solde insuffisant" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await client
    .from("bets")
    .select("id")
    .eq("user_id", user.id)
    .eq("date_str", date_str)
    .eq("reunion", reunion)
    .eq("course", course)
    .limit(1);

  if (existingError) {
    return NextResponse.json({ success: false, error: normalizeSupabaseAppError(existingError) }, { status: 500 });
  }

  if (existing && existing.length > 0) {
    return NextResponse.json({ success: false, error: "Vous avez deja parie sur cette course" }, { status: 400 });
  }

  const { error: betError } = await client.from("bets").insert({
    user_id: user.id,
    date_str,
    reunion,
    course,
    hippodrome: hippodrome || "",
    heure_depart: heure_depart || "",
    cheval_num,
    cheval_nom,
    type_pari,
    mise,
    cote,
    statut: "EN_ATTENTE",
    gain: null,
  });

  if (betError) {
    return NextResponse.json({ success: false, error: normalizeSupabaseAppError(betError) }, { status: 500 });
  }

  const { error: updateError } = await client
    .from("profiles")
    .update({ solde: solde - mise })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ success: false, error: normalizeSupabaseAppError(updateError) }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    solde: solde - mise,
  });
}
