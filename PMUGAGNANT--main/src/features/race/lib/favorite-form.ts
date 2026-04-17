export interface FavoriteFormPoint {
  label: string;
  score: number;
  tone: "strong" | "good" | "neutral" | "weak";
}

export interface FavoriteFormTrend {
  direction: "up" | "down" | "flat";
  label: string;
}

function scorePosition(token: string) {
  const numeric = Number.parseInt(token, 10);
  if (Number.isFinite(numeric) && numeric > 0) {
    if (numeric === 1) return 100;
    if (numeric <= 3) return 78;
    if (numeric <= 5) return 58;
    if (numeric <= 8) return 36;
    return 22;
  }

  const normalized = token.toUpperCase();
  if (normalized === "D" || normalized === "DAI" || normalized === "DPG") return 10;
  if (normalized === "A" || normalized === "AR") return 14;
  if (normalized === "T" || normalized === "NP") return 20;
  return 42;
}

function getTone(score: number): FavoriteFormPoint["tone"] {
  if (score >= 80) return "strong";
  if (score >= 58) return "good";
  if (score >= 35) return "neutral";
  return "weak";
}

export function parseFavoriteForm(musique?: string | null, limit = 5): FavoriteFormPoint[] {
  const tokens = (musique ?? "")
    .toUpperCase()
    .match(/DAI|DPG|AR|NP|\d+|[A-Z]/g);

  const merged: string[] = [];
  const rawTokens = tokens ?? [];
  for (let index = 0; index < rawTokens.length; index += 1) {
    const token = rawTokens[index];
    const next = rawTokens[index + 1];
    if (token === "D" && next === "A") {
      merged.push("DAI");
      index += 1;
      continue;
    }

    merged.push(token);
  }

  const cleaned = merged.filter((token) => !["P", "M", "H", "S"].includes(token)).slice(0, limit);
  if (cleaned.length === 0) {
    return Array.from({ length: limit }, (_, index) => ({
      label: `C${index + 1}`,
      score: 42,
      tone: "neutral" as const,
    }));
  }

  return cleaned.map((token) => {
    const score = scorePosition(token);
    return {
      label: token,
      score,
      tone: getTone(score),
    };
  });
}

export function getFavoriteFormTrend(points: FavoriteFormPoint[]): FavoriteFormTrend {
  if (points.length < 3) {
    return { direction: "flat", label: "Tendance stable" };
  }

  const recent = points.slice(0, 2).reduce((sum, point) => sum + point.score, 0) / 2;
  const olderWindow = points.slice(-2);
  const older =
    olderWindow.reduce((sum, point) => sum + point.score, 0) /
    Math.max(olderWindow.length, 1);
  const delta = recent - older;

  if (delta >= 18) {
    return { direction: "up", label: "Tendance en hausse" };
  }

  if (delta <= -18) {
    return { direction: "down", label: "Tendance en baisse" };
  }

  return { direction: "flat", label: "Tendance stable" };
}
