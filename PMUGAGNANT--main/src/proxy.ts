import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RATE_LIMIT_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

type RateLimitResult =
  | { allowed: true; limit: number; remaining: number; resetAt: number }
  | { allowed: false; limit: number; remaining: 0; resetAt: number };

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

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

function getApiRateLimit(pathname: string) {
  if (pathname.startsWith("/api/admin")) {
    return 40;
  }

  if (pathname.startsWith("/api/cron")) {
    return 120;
  }

  return 240;
}

function cleanupExpiredBuckets(now: number) {
  if (rateBuckets.size < 500) {
    return;
  }

  for (const [key, bucket] of rateBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateBuckets.delete(key);
    }
  }
}

function checkRateLimit(request: NextRequest): RateLimitResult {
  const now = Date.now();
  const pathname = request.nextUrl.pathname;
  const limit = getApiRateLimit(pathname);
  const key = `${getClientIp(request)}:${pathname}`;
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateBuckets.set(key, { count: 1, resetAt });
    cleanupExpiredBuckets(now);
    return { allowed: true, limit, remaining: limit - 1, resetAt };
  }

  if (current.count >= limit) {
    return { allowed: false, limit, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

function withRateLimitHeaders(response: NextResponse, result: RateLimitResult) {
  response.headers.set("x-ratelimit-limit", String(result.limit));
  response.headers.set("x-ratelimit-remaining", String(result.remaining));
  response.headers.set("x-ratelimit-reset", String(Math.ceil(result.resetAt / 1000)));
  return response;
}

/**
 * Heavy backtest refresh is public on /api/backtest but must not be abusable in production.
 * This does not replace route logic; it only gates ?refresh=1 when NODE_ENV=production.
 */
export function proxy(request: NextRequest) {
  const rateLimit = checkRateLimit(request);
  if (!rateLimit.allowed) {
    return withRateLimitHeaders(
      NextResponse.json(
        { success: false, error: "Trop de requetes. Reessayez dans quelques instants." },
        { status: 429 }
      ),
      rateLimit
    );
  }

  if (request.nextUrl.pathname !== "/api/backtest") {
    return withRateLimitHeaders(NextResponse.next(), rateLimit);
  }

  if (request.nextUrl.searchParams.get("refresh") !== "1") {
    return withRateLimitHeaders(NextResponse.next(), rateLimit);
  }

  if (process.env.NODE_ENV !== "production") {
    return withRateLimitHeaders(NextResponse.next(), rateLimit);
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return withRateLimitHeaders(
      NextResponse.json(
        { success: false, error: "CRON_SECRET is required for backtest refresh in production." },
        { status: 503 }
      ),
      rateLimit
    );
  }

  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const token = request.nextUrl.searchParams.get("token");

  const ok =
    (bearer != null && bearer.length > 0 && timingSafeEqualString(secret, bearer)) ||
    (token != null && token.length > 0 && timingSafeEqualString(secret, token));

  if (!ok) {
    return withRateLimitHeaders(
      NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
      rateLimit
    );
  }

  return withRateLimitHeaders(NextResponse.next(), rateLimit);
}

export const config = {
  matcher: "/api/:path*",
};
