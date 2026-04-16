import { NextRequest, NextResponse } from "next/server";
import { ensureCronAuthorized } from "@/lib/cron-auth";
import { badRequest, serverError } from "@/lib/api-response";
import { clearElitePerformersCache } from "@/lib/predictions/signals";
import { getRequiredSupabaseAdminClient } from "@/lib/supabase";
import type { ElitePerformerRow, ElitePerformerType } from "@/lib/types";

export const dynamic = "force-dynamic";

const ELITE_TYPES: ElitePerformerType[] = ["JOCKEY_FLAT", "JOCKEY_TROT", "TRAINER"];

type ElitePerformerPayload = Partial<ElitePerformerRow> & {
  nom?: string;
};

function normalizeName(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function isEliteType(value: unknown): value is ElitePerformerType {
  return typeof value === "string" && ELITE_TYPES.includes(value as ElitePerformerType);
}

function toUpsertRow(payload: ElitePerformerPayload): ElitePerformerRow | null {
  if (!isEliteType(payload.type)) {
    return null;
  }

  const nomNormalise = normalizeName(payload.nom_normalise ?? payload.nom);
  const score = Number(payload.score);
  if (!nomNormalise || !Number.isFinite(score)) {
    return null;
  }

  return {
    type: payload.type,
    nom_normalise: nomNormalise,
    score: Math.max(1, Math.min(10, Math.round(score))),
    actif: payload.actif ?? true,
  };
}

export async function GET(request: NextRequest) {
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) return unauthorized;

  try {
    const admin = getRequiredSupabaseAdminClient();
    const { data, error } = await admin
      .from("elite_performers")
      .select("*")
      .order("type", { ascending: true })
      .order("score", { ascending: false })
      .order("nom_normalise", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, performers: data ?? [] });
  } catch (error) {
    return serverError("Echec du chargement des performers elite.", error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Payload JSON invalide.");
  }

  const payloads = Array.isArray(body) ? body : [body];
  const rows = payloads
    .map((payload) => toUpsertRow(payload as ElitePerformerPayload))
    .filter((row): row is ElitePerformerRow => row !== null);

  if (rows.length === 0) {
    return badRequest("Aucun performer elite valide a upsert.");
  }

  try {
    const admin = getRequiredSupabaseAdminClient();
    const { data, error } = await admin
      .from("elite_performers")
      .upsert(rows, { onConflict: "type,nom_normalise" })
      .select("*");

    if (error) {
      throw new Error(error.message);
    }

    clearElitePerformersCache();
    return NextResponse.json({ success: true, performers: data ?? [] });
  } catch (error) {
    return serverError("Echec de l'upsert des performers elite.", error);
  }
}
