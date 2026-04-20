import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getBearerToken } from "@/lib/request-utils";

function safeSecretEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function expandTokenCandidate(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return [];
  }

  const candidates = [trimmed];
  const plusFixed = trimmed.replaceAll(" ", "+");
  if (plusFixed !== trimmed) {
    candidates.push(plusFixed);
  }

  return candidates;
}

export function isCronSecretCandidateValid(
  configuredSecret: string,
  rawCandidates: Array<string | null | undefined>
) {
  return rawCandidates
    .flatMap((candidate) => expandTokenCandidate(candidate))
    .some((candidate) => safeSecretEqual(configuredSecret, candidate));
}

function getCronTokenCandidates(request: NextRequest) {
  return [getBearerToken(request.headers.get("authorization"))];
}

export function ensureCronAuthorized(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  const candidates = getCronTokenCandidates(request);

  if (!configuredSecret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET absent." },
      { status: 401 }
    );
  }

  if (isCronSecretCandidateValid(configuredSecret, candidates)) {
    return null;
  }

  return NextResponse.json(
    {
      success: false,
      error: "CRON_SECRET invalide ou manquant.",
      hint: "Envoyez le secret via Authorization: Bearer <CRON_SECRET>.",
    },
    { status: 401 }
  );
}
