import { NextRequest, NextResponse } from "next/server";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export function ensureCronAuthorized(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  const bearerToken = getBearerToken(request);
  const queryToken = new URL(request.url).searchParams.get("token");
  const vercelCronHeader = request.headers.get("x-vercel-cron");

  if (!configuredSecret) {
    if (process.env.NODE_ENV !== "production" || vercelCronHeader) {
      return null;
    }
  }

  if (
    configuredSecret &&
    (configuredSecret === bearerToken || configuredSecret === queryToken)
  ) {
    return null;
  }

  if (!configuredSecret && process.env.NODE_ENV !== "production") {
    return null;
  }

  return NextResponse.json(
    { success: false, error: "Unauthorized cron request" },
    { status: 401 }
  );
}
