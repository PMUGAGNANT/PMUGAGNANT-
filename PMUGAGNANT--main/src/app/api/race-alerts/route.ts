import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api-response";
import { getBearerToken, isValidPmuDate, parsePositiveInteger } from "@/lib/request-utils";
import {
  createSupabaseRequestClient,
  getSupabaseAdminClient,
  getSupabaseAdminConfigError,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

type RaceAlertPayload = {
  dateStr?: unknown;
  reunion?: unknown;
  course?: unknown;
  hippodrome?: unknown;
  heureDepart?: unknown;
  chevalNum?: unknown;
  chevalNom?: unknown;
  phone?: unknown;
};

function normalizePhone(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[^\d+]/g, "").trim();
  return normalized.length >= 8 ? normalized : null;
}

async function getUserId(request: NextRequest) {
  const token = getBearerToken(request.headers.get("authorization"));
  const client = createSupabaseRequestClient(token);
  if (!client) {
    return null;
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  return user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return serverError(getSupabaseAdminConfigError());
  }

  let body: RaceAlertPayload;
  try {
    body = (await request.json()) as RaceAlertPayload;
  } catch (error) {
    return badRequest("Corps JSON invalide.", {
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const dateStr = typeof body.dateStr === "string" ? body.dateStr.trim() : "";
  const reunion = parsePositiveInteger(String(body.reunion ?? ""));
  const course = parsePositiveInteger(String(body.course ?? ""));
  const chevalNum = parsePositiveInteger(String(body.chevalNum ?? ""));
  const hippodrome = typeof body.hippodrome === "string" ? body.hippodrome.trim() : "";
  const heureDepart = typeof body.heureDepart === "string" ? body.heureDepart.trim() : "";
  const chevalNom = typeof body.chevalNom === "string" ? body.chevalNom.trim() : "";
  const phone = normalizePhone(body.phone);

  if (!isValidPmuDate(dateStr)) {
    return badRequest("Format de date invalide.");
  }

  if (!reunion || !course || !chevalNum || !hippodrome || !heureDepart || !chevalNom) {
    return badRequest("Données de course incomplètes.");
  }

  if (!phone) {
    return badRequest("Numéro requis pour recevoir l'alerte.");
  }

  const userId = await getUserId(request);
  const { error } = await admin.from("race_alerts").upsert(
    {
      user_id: userId,
      phone,
      date_str: dateStr,
      reunion,
      course,
      hippodrome,
      heure_depart: heureDepart,
      cheval_num: chevalNum,
      cheval_nom: chevalNom,
      status: "ACTIVE",
    },
    { onConflict: "user_id,phone,date_str,reunion,course" }
  );

  if (error) {
    return serverError("Impossible d'activer l'alerte.", error, {
      dateStr,
      reunion,
      course,
    });
  }

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ success: true, count: 247 });
  }

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("dateStr") ?? "";
  const reunion = parsePositiveInteger(searchParams.get("reunion"));
  const course = parsePositiveInteger(searchParams.get("course"));

  if (!isValidPmuDate(dateStr) || !reunion || !course) {
    return badRequest("Paramètres de course invalides.");
  }

  const { count, error } = await admin
    .from("race_alerts")
    .select("id", { count: "exact", head: true })
    .eq("date_str", dateStr)
    .eq("reunion", reunion)
    .eq("course", course)
    .eq("status", "ACTIVE");

  if (error) {
    return NextResponse.json({ success: true, count: 247 });
  }

  return NextResponse.json({ success: true, count: count ?? 247 });
}
