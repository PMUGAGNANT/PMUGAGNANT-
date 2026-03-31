import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Constant-time comparison for Edge (no node:crypto). */
function timingSafeEqualString(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Heavy backtest refresh is public on /api/backtest but must not be abusable in production.
 * This does not replace route logic; it only gates ?refresh=1 when NODE_ENV=production.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/api/backtest") {
    return NextResponse.next();
  }

  if (request.nextUrl.searchParams.get("refresh") !== "1") {
    return NextResponse.next();
  }

  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET is required for backtest refresh in production." },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const token = request.nextUrl.searchParams.get("token");

  const ok =
    (bearer != null && bearer.length > 0 && timingSafeEqualString(secret, bearer)) ||
    (token != null && token.length > 0 && timingSafeEqualString(secret, token));

  if (!ok) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/backtest",
};
