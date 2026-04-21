import { NextRequest, NextResponse } from "next/server";
import { ensureCronAuthorized } from "@/lib/cron-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram";
import { logger } from "@/lib/server-logger";

export const CRON_TIMEOUT_MS = 55_000;

type CronStatus = "SUCCESS" | "FAILED" | "TIMEOUT" | "UNAUTHORIZED";

export interface CronRoutePayload {
  success?: boolean;
  coursesProcessed?: number;
  racesProcessed?: number;
  [key: string]: unknown;
}

interface CronLogPayload {
  route: string;
  status: CronStatus;
  durationMs: number;
  coursesProcessed?: number;
  error?: string | null;
}

export interface CronRouteContext {
  route: string;
  startedAt: number;
  signal: AbortSignal;
}

class CronTimeoutError extends Error {
  constructor(route: string) {
    super(`Cron ${route} timeout apres ${CRON_TIMEOUT_MS} ms`);
    this.name = "CronTimeoutError";
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractCoursesProcessed(payload: unknown) {
  const record = isRecord(payload) ? payload : {};
  const summary = isRecord(record.summary) ? record.summary : {};
  const candidates = [
    record.coursesProcessed,
    record.racesProcessed,
    summary.racesProcessed,
  ];

  const value = candidates.find(
    (candidate): candidate is number =>
      typeof candidate === "number" && Number.isFinite(candidate)
  );

  return value ?? 0;
}

async function writeCronLog(payload: CronLogPayload) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    logger.warn("cron.log.supabase_unavailable", {
      route: payload.route,
      status: payload.status,
    });
    return;
  }

  const { error } = await admin.from("cron_logs").insert({
    route: payload.route,
    status: payload.status,
    duration_ms: Math.round(payload.durationMs),
    courses_processed: payload.coursesProcessed ?? 0,
    errors: payload.error?.slice(0, 2000) ?? null,
  });

  if (error) {
    logger.error("cron.log.insert_failed", error, {
      route: payload.route,
      status: payload.status,
    });
  }
}

async function alertCronFailure(route: string, message: string) {
  if (!isTelegramConfigured()) {
    return;
  }

  try {
    await sendTelegramMessage(`⚠️ ALERTE TURFEDGE: ${route} - ${message}`);
  } catch (error) {
    logger.error("cron.alert.failed", error, { route });
  }
}

async function withTimeout<T>(
  route: string,
  controller: AbortController,
  operation: () => Promise<T>
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new CronTimeoutError(route));
    }, CRON_TIMEOUT_MS);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function runCronRoute(
  request: NextRequest,
  route: string,
  operation: (context: CronRouteContext) => Promise<unknown>
) {
  const startedAt = Date.now();
  const unauthorized = ensureCronAuthorized(request);

  if (unauthorized) {
    await writeCronLog({
      route,
      status: "UNAUTHORIZED",
      durationMs: Date.now() - startedAt,
      error: "CRON_SECRET invalide ou manquant",
    });
    return unauthorized;
  }

  const controller = new AbortController();

  try {
    const payload = await withTimeout(route, controller, () =>
      operation({
        route,
        startedAt,
        signal: controller.signal,
      })
    );
    const durationMs = Date.now() - startedAt;

    await writeCronLog({
      route,
      status: "SUCCESS",
      durationMs,
      coursesProcessed: extractCoursesProcessed(payload),
    });

    return NextResponse.json({
      success: true,
      route,
      durationMs,
      ...(isRecord(payload) ? payload : { result: payload }),
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const isTimeout = error instanceof CronTimeoutError;
    const message = getErrorMessage(error);

    logger.error("cron.route.failed", error, { route, durationMs });
    await writeCronLog({
      route,
      status: isTimeout ? "TIMEOUT" : "FAILED",
      durationMs,
      error: message,
    });
    await alertCronFailure(route, message);

    return NextResponse.json(
      {
        success: false,
        route,
        error: message,
        durationMs,
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
