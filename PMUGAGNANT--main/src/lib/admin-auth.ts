import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/request-utils";

function getAdminSecret() {
  return (
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.ADMIN_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

function safeCompare(secret: string, candidate: string | null | undefined) {
  if (!candidate) {
    return false;
  }

  const left = Buffer.from(secret);
  const right = Buffer.from(candidate);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function ensureAdminAuthorized(request: NextRequest) {
  const secret = getAdminSecret();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "ADMIN_PASSWORD or CRON_SECRET is required in production." },
        { status: 503 }
      );
    }

    return null;
  }

  const headerSecret = request.headers.get("x-admin-password");
  const bearer = getBearerToken(request.headers.get("authorization"));
  const querySecret = request.nextUrl.searchParams.get("password");

  if (
    safeCompare(secret, headerSecret) ||
    safeCompare(secret, bearer) ||
    safeCompare(secret, querySecret)
  ) {
    return null;
  }

  return NextResponse.json({ success: false, error: "Mot de passe admin invalide." }, { status: 401 });
}
