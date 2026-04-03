import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api-response";
import { getAuthenticatedRequestUser } from "@/lib/request-auth";
import {
  calculateStreaksFromBets,
  createUserStreakSnapshot,
  type UserBetOutcomeRow,
} from "@/lib/user-streak";

export const dynamic = "force-dynamic";

type UserStreakRow = {
  current_streak: number | null;
  best_streak: number | null;
  total_followed: number | null;
  total_won: number | null;
};

function getSnapshotFromRow(row: UserStreakRow | null) {
  if (!row) {
    return null;
  }

  const totalFollowed = row.total_followed ?? 0;
  const totalWon = row.total_won ?? 0;
  const currentStreak = row.current_streak ?? 0;
  const bestStreak = row.best_streak ?? 0;

  if (totalFollowed <= 0 && totalWon <= 0 && currentStreak <= 0 && bestStreak <= 0) {
    return null;
  }

  return createUserStreakSnapshot({
    current_streak: currentStreak,
    best_streak: bestStreak,
    total_followed: totalFollowed,
    total_won: totalWon,
  });
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const { client, user } = auth;

  try {
    const [{ data: streakRow, error: streakError }, { data: bets, error: betsError }] =
      await Promise.all([
        client
          .from("user_streaks")
          .select("current_streak,best_streak,total_followed,total_won")
          .eq("user_id", user.id)
          .maybeSingle(),
        client
          .from("bets")
          .select("id,date_str,created_at,statut")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

    if (streakError) {
      return serverError("Impossible de charger la serie utilisateur.", streakError, {
        userId: user.id,
      });
    }

    if (betsError) {
      return serverError("Impossible de charger les paris utilisateur.", betsError, {
        userId: user.id,
      });
    }

    const fromRow = getSnapshotFromRow(streakRow as UserStreakRow | null);
    const computed = createUserStreakSnapshot(
      calculateStreaksFromBets((bets ?? []) as UserBetOutcomeRow[])
    );

    const payload = fromRow ?? computed;

    return NextResponse.json({
      success: true,
      ...payload,
    });
  } catch (error) {
    return serverError("Impossible de calculer la serie utilisateur.", error, {
      userId: user.id,
    });
  }
}
