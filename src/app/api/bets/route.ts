import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabaseClient(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
  return client;
}

// GET /api/bets - List user bets
export async function GET(req: NextRequest) {
  const client = getSupabaseClient(req);
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Non connecté" }, { status: 401 });
  }

  const { data: bets, error } = await client
    .from("bets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Get user profile for solde
  const { data: profile } = await client
    .from("profiles")
    .select("solde")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    success: true,
    bets: bets || [],
    solde: profile?.solde ?? 1000,
  });
}

// POST /api/bets - Place a bet
export async function POST(req: NextRequest) {
  const client = getSupabaseClient(req);
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Non connecté" }, { status: 401 });
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

  // Validate
  if (!date_str || !reunion || !course || !cheval_num || !cheval_nom || !type_pari || !mise || !cote) {
    return NextResponse.json({ success: false, error: "Données manquantes" }, { status: 400 });
  }

  if (mise < 1 || mise > 50) {
    return NextResponse.json({ success: false, error: "Mise entre 1 et 50" }, { status: 400 });
  }

  if (!["GAGNANT", "PLACE"].includes(type_pari)) {
    return NextResponse.json({ success: false, error: "Type de pari invalide" }, { status: 400 });
  }

  // Check solde
  const { data: profile } = await client
    .from("profiles")
    .select("solde")
    .eq("id", user.id)
    .single();

  const solde = profile?.solde ?? 1000;
  if (solde < mise) {
    return NextResponse.json({ success: false, error: "Solde insuffisant" }, { status: 400 });
  }

  // Check no duplicate bet on same race
  const { data: existing } = await client
    .from("bets")
    .select("id")
    .eq("user_id", user.id)
    .eq("date_str", date_str)
    .eq("reunion", reunion)
    .eq("course", course)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ success: false, error: "Vous avez déjà parié sur cette course" }, { status: 400 });
  }

  // Insert bet
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
    return NextResponse.json({ success: false, error: betError.message }, { status: 500 });
  }

  // Deduct mise from solde
  await client
    .from("profiles")
    .update({ solde: solde - mise })
    .eq("id", user.id);

  return NextResponse.json({
    success: true,
    solde: solde - mise,
  });
}
