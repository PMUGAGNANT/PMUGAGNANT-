import { NextResponse } from "next/server";
import { logger } from "@/lib/server-logger";

export function badRequest(message: string, details?: Record<string, unknown>) {
  return NextResponse.json(
    { success: false, error: message, ...(details ?? {}) },
    { status: 400 }
  );
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

export function serverError(message: string, error?: unknown, context?: Record<string, unknown>) {
  logger.error(message, error, context);
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}
