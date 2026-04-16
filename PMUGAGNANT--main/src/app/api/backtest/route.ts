import { NextResponse } from "next/server";

import { badRequest, serverError } from "@/lib/api-response";
import { getCachedBacktest, persistBacktest, runBacktest } from "@/lib/backtesting";
import { parsePositiveInteger } from "@/lib/request-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const daysRaw = searchParams.get("days");
  const referenceDateRaw = searchParams.get("date");
  const refresh = searchParams.get("refresh") === "1";
  const days = daysRaw ? parsePositiveInteger(daysRaw) : 90;

  if (!days || days < 1 || days > 400) {
    return badRequest("Paramètre `days` invalide. Valeur attendue : 1 à 400.");
  }

  const referenceDate = referenceDateRaw ? new Date(referenceDateRaw) : new Date();
  if (Number.isNaN(referenceDate.getTime())) {
    return badRequest("Paramètre `date` invalide. Format attendu : date ISO.");
  }

  try {
    if (!refresh) {
      const cached = await getCachedBacktest(days);
      if (cached) {
        return NextResponse.json({ success: true, backtest: cached, cached: true });
      }

      return NextResponse.json({ success: true, backtest: null, cached: false });
    }

    const summary = await runBacktest(days, referenceDate);
    await persistBacktest(days, summary);
    return NextResponse.json({ success: true, backtest: summary, cached: false });
  } catch (error) {
    return serverError("Échec du chargement du backtest.", error, {
      days,
      date: referenceDateRaw ?? null,
    });
  }
}
