const INTERNAL_ORIGIN = "https://pmugagnant.local";

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = "/"
) {
  const candidate = value?.trim();

  if (!candidate) {
    return fallback;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }

  try {
    const url = new URL(candidate, INTERNAL_ORIGIN);

    if (url.origin !== INTERNAL_ORIGIN) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}
