import { NextRequest, NextResponse } from "next/server";
import { parsePositiveInteger } from "@/lib/request-utils";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function aggregateRows(rows: { cheval_num: number }[] | null): { cheval_num: number; count: number }[] {
  const m = new Map<number, number>();
  for (const r of rows ?? []) {
    const n = Number(r.cheval_num);
    if (!Number.isFinite(n)) continue;
    m.set(n, (m.get(n) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([cheval_num, count]) => ({ cheval_num, count }))
    .sort((a, b) => b.count - a.count);
}

export async function GET(request: NextRequest) {
  const raceId = request.nextUrl.searchParams.get("race_id");
  if (!raceId?.trim()) {
    return NextResponse.json({ success: false, error: "race_id requis" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ success: true, rows: [] });
  }

  const { data, error } = await admin
    .from("community_picks")
    .select("cheval_num")
    .eq("race_id", raceId.trim());

  if (error) {
    return NextResponse.json({ success: true, rows: [] });
  }

  return NextResponse.json({ success: true, rows: aggregateRows(data as { cheval_num: number }[]) });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON invalide" }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  const raceId = typeof rec.race_id === "string" ? rec.race_id.trim() : "";
  const chevalNum = parsePositiveInteger(String(rec.cheval_num ?? ""));

  if (!raceId || chevalNum == null) {
    return NextResponse.json({ success: false, error: "race_id et cheval_num requis" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Votes non disponibles (Supabase admin requis)" },
      { status: 503 }
    );
  }

  const voterId = typeof rec.voter_id === "string" ? rec.voter_id : null;

  const { error } = await admin.from("community_picks").insert({
    race_id: raceId,
    cheval_num: chevalNum,
    voter_id: voterId,
  });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
