import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseRequestClient,
  getSupabaseConfigError,
  getSupabaseSetupError,
  normalizeSupabaseAppError,
} from "@/lib/supabase";

const PMU_API = "https://online.turfinfo.api.pmu.fr/rest/client/1";

function getSupabaseClient(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return createSupabaseRequestClient(token);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// POST /api/bets/settle - Settle pending bets by checking results
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

  const { data: pendingBets, error: pendingError } = await client
    .from("bets")
    .select("*")
    .eq("user_id", user.id)
    .eq("statut", "EN_ATTENTE");

  if (pendingError) {
    return NextResponse.json({ success: false, error: normalizeSupabaseAppError(pendingError) }, { status: 500 });
  }

  if (!pendingBets || pendingBets.length === 0) {
    return NextResponse.json({ success: true, settled: 0 });
  }

  let settledCount = 0;
  let totalGains = 0;

  for (const bet of pendingBets) {
    try {
      const url = `${PMU_API}/programme/${bet.date_str}/R${bet.reunion}/C${bet.course}/participants`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const participants = data.participants || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const horse = participants.find((p: any) => p.numPmu === bet.cheval_num);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const horse2 = bet.cheval_num_2 ? participants.find((p: any) => p.numPmu === bet.cheval_num_2) : null;

      if (!horse || !horse.ordreArrivee) continue;

      const position = Number(horse.ordreArrivee);
      const position2 = horse2?.ordreArrivee ? Number(horse2.ordreArrivee) : null;
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
      } else if (bet.type_pari === "COUPLE_GAGNANT") {
        if (position2 && position <= 2 && position2 <= 2) {
          statut = "GAGNE";
          gain = round2(bet.mise * bet.cote - bet.mise);
        } else {
          statut = "PERDU";
          gain = -bet.mise;
        }
      } else if (bet.type_pari === "COUPLE_PLACE") {
        if (position2 && position <= 3 && position2 <= 3) {
          statut = "PLACE";
          gain = round2(Math.max(0, bet.mise * bet.cote - bet.mise));
        } else {
          statut = "PERDU";
          gain = -bet.mise;
        }
      } else if (position <= 3) {
        statut = "PLACE";
        gain = round2(Math.round((bet.mise * (bet.cote * 0.3) - bet.mise) * 100) / 100);
        if (gain < 0) gain = 0;
      } else {
        statut = "PERDU";
        gain = -bet.mise;
      }

      const { error: betUpdateError } = await client.from("bets").update({ statut, gain }).eq("id", bet.id);
      if (betUpdateError) {
        return NextResponse.json({ success: false, error: normalizeSupabaseAppError(betUpdateError) }, { status: 500 });
      }

      if (gain > 0) {
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

        const currentSolde = profile.solde ?? 1000;
        const { error: profileUpdateError } = await client
          .from("profiles")
          .update({ solde: currentSolde + gain + bet.mise })
          .eq("id", user.id);

        if (profileUpdateError) {
          return NextResponse.json({ success: false, error: normalizeSupabaseAppError(profileUpdateError) }, { status: 500 });
        }

        totalGains += gain + bet.mise;
      }

      settledCount++;
    } catch {
      continue;
    }
  }

  return NextResponse.json({
    success: true,
    settled: settledCount,
    totalGains,
  });
}
