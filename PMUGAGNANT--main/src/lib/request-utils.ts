export function isValidPmuDate(dateStr: string) {
  return /^\d{8}$/.test(dateStr);
}

export function normalizeRequestedDate(dateStr: string | null | undefined, fallback: string) {
  if (!dateStr) {
    return fallback;
  }

  return isValidPmuDate(dateStr) ? dateStr : null;
}

export function parsePositiveInteger(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function parseOptionalFiniteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : undefined;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
