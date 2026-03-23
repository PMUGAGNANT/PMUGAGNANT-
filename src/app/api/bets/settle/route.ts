import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseRequestClient,
  getSupabaseConfigError,
} from "@/lib/supabase";

const PMU_API = "https://online.turfinfo.api.pmu.fr/rest/client/1";

function getSupabaseClient(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return createSupabaseRequestClient(token);
}

// POST /api/bets/settle - Settle pending bets by checking results
export async function POST(req: NextRequest) {
  const client = getSupabaseClient(req);
  if (!client) {
    return NextResponse.json({ success: false, error: getSupabaseConfigError() }, { status: 500 });
  }

  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Non connecté" }, { status: 401 });
  }

  // Get all pending bets for user
  const { data: pendingBets } = await client
    .from("bets")
    .select("*")
    .eq("user_id", user.id)
    .eq("statut", "EN_ATTENTE");

  if (!pendingBets || pendingBets.length === 0) {
    return NextResponse.json({ success: true, settled: 0 });
  }

  let settledCount = 0;
  let totalGains = 0;

  for (const bet of pendingBets) {
    try {
      // Fetch race results from PMU API
      const url = `${PMU_API}/programme/${bet.date_str}/R${bet.reunion}/C${bet.course}/participants`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const participants = data.participants || [];

      // Find our horse
      const horse = participants.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.numPmu === bet.cheval_num
      );
      if (!horse || !horse.ordreArrivee) continue; // race not finished yet

      const position = horse.ordreArrivee;
      let statut: string;
      let gain: number;

      if (bet.type_pari === "GAGNANT") {
        if (position === 1) {
          statut = "GAGNE";
          gain = bet.mise * bet.cote - bet.mise;
        } else {
          statut = "PERDU";
          gain = -bet.mise;
        }
      } else {
        // PLACE - top 3
        if (position <= 3) {
          statut = "PLACE";
          gain = Math.round((bet.mise * (bet.cote * 0.3) - bet.mise) * 100) / 100;
          // Minimum gain for place = 0 (return stake if cote too low)
          if (gain < 0) gain = 0;
        } else {
          statut = "PERDU";
          gain = -bet.mise;
        }
      }

      // Update bet
      await client
        .from("bets")
        .update({ statut, gain })
        .eq("id", bet.id);

      // Update solde (add back gains, or nothing if lost since we already deducted)
      if (gain > 0) {
        const { data: profile } = await client
          .from("profiles")
          .select("solde")
          .eq("id", user.id)
          .single();

        const currentSolde = profile?.solde ?? 1000;
        await client
          .from("profiles")
          .update({ solde: currentSolde + gain + bet.mise }) // return stake + gains
          .eq("id", user.id);

        totalGains += gain + bet.mise;
      }

      settledCount++;
    } catch {
      // Skip this bet if API fails
      continue;
    }
  }

  return NextResponse.json({
    success: true,
    settled: settledCount,
    totalGains,
  });
}
