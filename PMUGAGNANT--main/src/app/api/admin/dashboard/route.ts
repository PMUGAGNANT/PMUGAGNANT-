import { NextRequest, NextResponse } from "next/server";
import { ensureAdminAuthorized } from "@/lib/admin-auth";
import { serverError } from "@/lib/api-response";
import { loadAdminDashboardData } from "@/lib/admin-dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = ensureAdminAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const dashboard = await loadAdminDashboardData();
    return NextResponse.json({ success: true, dashboard });
  } catch (error) {
    return serverError("Admin dashboard failed", error);
  }
}
