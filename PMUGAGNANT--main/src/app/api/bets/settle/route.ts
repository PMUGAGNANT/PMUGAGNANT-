import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseRequestClient,
  getSupabaseAdminClient,
  getSupabaseConfigError,
} from "@/lib/supabase";
import { getFinalReports, getParticipants } from "@/lib/pmu-api";
import { serverError, unauthorized } from "@/lib/api-response";
import { getBearerToken } from "@/lib/request-utils";
import { logger } from "@/lib/server-logger";

function getSupabaseClient(req: NextRequest) {
  const token = getBearerToken(req.headers.get("authorization"));
  return createSupabaseRequestClient(token);
}

export async function POST(req: NextRequest) {
  const client = getSupabaseClient(req);
  if (!client) {
    return serverError(getSupabaseConfigError());
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return serverError("Supabase admin n'est pas configuré. Ajoutez SUPABASE_SERVICE_ROLE_KEY.");
  }

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError) {
    return serverError("Échec de l'authentification.", authError);
  }

  if (!user) {
    return unauthorized("Non connecté.");
  }

  const { data: pendingBets, error: betsError } = await client
    .from("bets")
    .select("*")
    .eq("user_id", user.id)
    .eq("statut", "EN_ATTENTE");

  if (betsError) {
    return serverError("Impossible de récupérer les paris en attente.", betsError, {
      userId: user.id,
    });
  }

  if (!pendingBets || pendingBets.length === 0) {
    return NextResponse.json({ success: true, settled: 0, totalGains: 0 });
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("solde")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return serverError("Impossible de récupérer le solde du profil.", profileError, {
      userId: user.id,
    });
  }

  let settledCount = 0;
  let totalReturnedToBalance = 0;
  let currentSolde = profile?.solde ?? 1000;

  for (const bet of pendingBets) {
    try {
      const [participants, reports] = await Promise.all([
        getParticipants(bet.date_str, bet.reunion, bet.course),
        getFinalReports(bet.date_str, bet.reunion, bet.course),
      ]);

      const horse = participants.find((participant) => participant.numPmu === bet.cheval_num);
      if (!horse || !horse.ordreArrivee) {
        continue;
      }

      const position = horse.ordreArrivee;
      let statut: string;
      let gain: number;
      let returnedToBalance = 0;

      if (bet.type_pari === "GAGNANT") {
        if (position === 1) {
          statut = "GAGNE";
          const report = reports.simpleGagnant[bet.cheval_num] ?? bet.cote ?? 0;
          gain = Math.round((bet.mise * report - bet.mise) * 100) / 100;
          returnedToBalance = Math.round((bet.mise + gain) * 100) / 100;
        } else {
          statut = "PERDU";
          gain = -bet.mise;
        }
      } else if (position <= 3) {
        statut = "PLACE";
        const report =
          reports.simplePlace[bet.cheval_num] ?? Math.max(1, (bet.cote ?? 0) * 0.3);
        gain = Math.round((bet.mise * report - bet.mise) * 100) / 100;
        if (gain < 0) gain = 0;
        returnedToBalance = Math.round((bet.mise + gain) * 100) / 100;
      } else {
        statut = "PERDU";
        gain = -bet.mise;
      }

      const { error: updateBetError } = await admin
        .from("bets")
        .update({ statut, gain })
        .eq("id", bet.id)
        .eq("user_id", user.id);

      if (updateBetError) {
        throw updateBetError;
      }

      if (returnedToBalance > 0) {
        currentSolde = Math.round((currentSolde + returnedToBalance) * 100) / 100;
        totalReturnedToBalance += returnedToBalance;
      }

      settledCount++;
    } catch (error) {
      logger.warn("bets.settle_single_failed", {
        userId: user.id,
        betId: bet.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (totalReturnedToBalance > 0) {
    const { error: updateProfileError } = await admin
      .from("profiles")
      .update({ solde: currentSolde })
      .eq("id", user.id);

    if (updateProfileError) {
      return serverError("Impossible de mettre à jour le solde du profil.", updateProfileError, {
        userId: user.id,
      });
    }
  }

  return NextResponse.json({
    success: true,
    settled: settledCount,
    totalGains: totalReturnedToBalance,
  });
}
