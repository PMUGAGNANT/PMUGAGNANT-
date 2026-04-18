import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getBearerToken } from "@/lib/request-utils";

const CRON_QUERY_KEYS = ["token", "secret", "cron_secret", "cronSecret", "key"] as const;
const CRON_HEADER_KEYS = ["x-cron-secret", "x-cron-token", "x-api-key"] as const;

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
  const url = new URL(request.url);
  const queryCandidates = CRON_QUERY_KEYS.map((key) => url.searchParams.get(key));
  const headerCandidates = CRON_HEADER_KEYS.map((key) => request.headers.get(key));

  return [
    getBearerToken(request.headers.get("authorization")),
    ...queryCandidates,
    ...headerCandidates,
  ];
}

export function ensureCronAuthorized(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  const candidates = getCronTokenCandidates(request);

  if (process.env.NODE_ENV === "production") {
    if (!configuredSecret) {
      return NextResponse.json(
        { success: false, error: "CRON_SECRET is required in production" },
        { status: 503 }
      );
    }
    if (isCronSecretCandidateValid(configuredSecret, candidates)) {
      return null;
    }
    return NextResponse.json(
      {
        success: false,
        error: "CRON_SECRET invalide ou manquant.",
        hint: "Envoyez le secret unique via Authorization: Bearer <CRON_SECRET>, x-cron-secret ou ?token=<CRON_SECRET>.",
      },
      { status: 401 }
    );
  }

  if (!configuredSecret) {
    return null;
  }

  if (isCronSecretCandidateValid(configuredSecret, candidates)) {
    return null;
  }

  return NextResponse.json(
    {
      success: false,
      error: "CRON_SECRET invalide ou manquant.",
      hint: "Envoyez le secret unique via Authorization: Bearer <CRON_SECRET>, x-cron-secret ou ?token=<CRON_SECRET>.",
    },
    { status: 401 }
  );
}
