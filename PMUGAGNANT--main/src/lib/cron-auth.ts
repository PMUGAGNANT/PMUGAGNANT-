import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getBearerToken } from "@/lib/request-utils";

function safeSecretEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function ensureCronAuthorized(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  const bearerToken = getBearerToken(request.headers.get("authorization"));
  const queryToken = new URL(request.url).searchParams.get("token");

  if (process.env.NODE_ENV === "production") {
    if (!configuredSecret) {
      return NextResponse.json(
        { success: false, error: "CRON_SECRET is required in production" },
        { status: 503 }
      );
    }
    if (
      (bearerToken && safeSecretEqual(configuredSecret, bearerToken)) ||
      (queryToken && safeSecretEqual(configuredSecret, queryToken))
    ) {
      return null;
    }
    return NextResponse.json(
      { success: false, error: "Unauthorized cron request" },
      { status: 401 }
    );
  }

  if (!configuredSecret) {
    return null;
  }

  if (
    (bearerToken && safeSecretEqual(configuredSecret, bearerToken)) ||
    (queryToken && safeSecretEqual(configuredSecret, queryToken))
  ) {
    return null;
  }

  return NextResponse.json(
    { success: false, error: "Unauthorized cron request" },
    { status: 401 }
  );
}
