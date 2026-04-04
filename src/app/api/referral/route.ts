import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { badRequest, serverError } from "@/lib/api-response";
import { getAuthenticatedRequestUser } from "@/lib/request-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  buildReferralShareUrl,
  generateReferralCode,
  normalizeReferralCode,
  REFERRAL_BONUS_DAYS,
} from "@/lib/referral";

export const dynamic = "force-dynamic";

function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return siteUrl && /^https?:\/\//.test(siteUrl) ? siteUrl : undefined;
}

async function ensureReferralCode(
  userId: string,
  currentCode: string | null,
  client: SupabaseClient
) {
  const existingCode = normalizeReferralCode(currentCode);
  if (existingCode) {
    return existingCode;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidate = generateReferralCode();
    const { data, error } = await client
      .from("profiles")
      .update({ referral_code: candidate })
      .eq("id", userId)
      .is("referral_code", null)
      .select("referral_code")
      .maybeSingle();

    if (!error && data?.referral_code) {
      return normalizeReferralCode(data.referral_code);
    }
  }

  const { data, error } = await client
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return normalizeReferralCode(data.referral_code);
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const { client, user } = auth;

  try {
    const { data: profile, error } = await client
      .from("profiles")
      .select("referral_code,referral_count,referral_premium_days")
      .eq("id", user.id)
      .single();

    if (error) {
      return serverError("Impossible de charger le parrainage.", error, {
        userId: user.id,
      });
    }

    const referralCode = await ensureReferralCode(user.id, profile.referral_code, client);

    return NextResponse.json({
      success: true,
      referral_code: referralCode,
      referral_count: profile.referral_count ?? 0,
      referral_premium_days: profile.referral_premium_days ?? 0,
      share_url: buildReferralShareUrl(referralCode, getSiteUrl()),
    });
  } catch (error) {
    return serverError("Impossible de preparer le code parrainage.", error, {
      userId: user.id,
    });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return serverError("Supabase admin n'est pas configure pour le parrainage.");
  }

  const { client, user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return badRequest("Corps JSON invalide.", {
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const referralCode = normalizeReferralCode(
    body && typeof body === "object" ? String((body as Record<string, unknown>).referral_code ?? "") : ""
  );

  if (!referralCode) {
    return badRequest("Code invalide.");
  }

  try {
    const { data: currentProfile, error: currentProfileError } = await client
      .from("profiles")
      .select("id,referral_code,referred_by,referral_premium_days")
      .eq("id", user.id)
      .single();

    if (currentProfileError) {
      return serverError("Impossible de charger votre profil.", currentProfileError, {
        userId: user.id,
      });
    }

    if (currentProfile.referred_by) {
      return badRequest("Vous avez deja utilise un code parrainage.");
    }

    const { data: sponsorProfile, error: sponsorError } = await admin
      .from("profiles")
      .select("id,referral_code,referral_count,referral_premium_days")
      .eq("referral_code", referralCode)
      .maybeSingle();

    if (sponsorError) {
      return serverError("Impossible de verifier le code parrainage.", sponsorError, {
        referralCode,
        userId: user.id,
      });
    }

    if (!sponsorProfile) {
      return badRequest("Code invalide.");
    }

    if (sponsorProfile.id === user.id) {
      return badRequest("Auto-parrainage impossible.");
    }

    const [currentUpdate, sponsorUpdate] = await Promise.all([
      admin
        .from("profiles")
        .update({
          referred_by: sponsorProfile.id,
          referral_premium_days: (currentProfile.referral_premium_days ?? 0) + REFERRAL_BONUS_DAYS,
        })
        .eq("id", user.id),
      admin
        .from("profiles")
        .update({
          referral_count: (sponsorProfile.referral_count ?? 0) + 1,
          referral_premium_days: (sponsorProfile.referral_premium_days ?? 0) + REFERRAL_BONUS_DAYS,
        })
        .eq("id", sponsorProfile.id),
    ]);

    if (currentUpdate.error) {
      return serverError("Impossible d'activer le bonus filleul.", currentUpdate.error, {
        userId: user.id,
        referralCode,
      });
    }

    if (sponsorUpdate.error) {
      return serverError("Impossible d'activer le bonus parrain.", sponsorUpdate.error, {
        userId: user.id,
        referralCode,
      });
    }

    return NextResponse.json({
      success: true,
      message: "7 jours premium actives !",
    });
  } catch (error) {
    return serverError("Impossible d'appliquer le code parrainage.", error, {
      userId: user.id,
      referralCode,
    });
  }
}
