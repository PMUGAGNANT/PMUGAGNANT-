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

type ExistingBet = {
  cheval_num: number;
  cheval_num_2?: number | null;
};

function buildBetSelectionKey(
  typePari: string,
  chevalNum: number,
  chevalNum2?: number | null
) {
  if (typePari === "COUPLE_GAGNANT" || typePari === "COUPLE_PLACE") {
    return [chevalNum, chevalNum2].filter(Boolean).sort((a, b) => Number(a) - Number(b)).join("-");
  }

  return String(chevalNum);
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
    cheval_num_2,
    cheval_nom_2,
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

  if (!["GAGNANT", "PLACE", "COUPLE_GAGNANT", "COUPLE_PLACE"].includes(type_pari)) {
    return NextResponse.json({ success: false, error: "Type de pari invalide" }, { status: 400 });
  }

  const isCoupleBet = type_pari === "COUPLE_GAGNANT" || type_pari === "COUPLE_PLACE";
  if (isCoupleBet && (!cheval_num_2 || !cheval_nom_2)) {
    return NextResponse.json({ success: false, error: "Le deuxieme cheval du couple est obligatoire" }, { status: 400 });
  }

  if (isCoupleBet && Number(cheval_num_2) === Number(cheval_num)) {
    return NextResponse.json({ success: false, error: "Le couple doit contenir deux chevaux differents" }, { status: 400 });
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
    .select("cheval_num, cheval_num_2")
    .eq("user_id", user.id)
    .eq("date_str", date_str)
    .eq("reunion", reunion)
    .eq("course", course)
    .eq("type_pari", type_pari);

  if (existingError) {
    return NextResponse.json({ success: false, error: normalizeSupabaseAppError(existingError) }, { status: 500 });
  }

  const newSelectionKey = buildBetSelectionKey(type_pari, Number(cheval_num), cheval_num_2 ? Number(cheval_num_2) : null);
  const duplicateExists = (existing as ExistingBet[] | null)?.some((bet) => {
    return buildBetSelectionKey(type_pari, Number(bet.cheval_num), bet.cheval_num_2 ? Number(bet.cheval_num_2) : null) === newSelectionKey;
  });

  if (duplicateExists) {
    return NextResponse.json({ success: false, error: "Vous avez deja place ce pari sur cette course" }, { status: 400 });
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
    cheval_num_2: isCoupleBet ? cheval_num_2 : null,
    cheval_nom_2: isCoupleBet ? cheval_nom_2 : null,
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
