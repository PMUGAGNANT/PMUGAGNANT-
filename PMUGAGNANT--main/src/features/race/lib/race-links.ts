import { formatRaceAnalysisId } from "@/features/vmax/vmax-model";

export function buildRacePath(reunion: number | string, course: number | string) {
  return `/race/${formatRaceAnalysisId(Number(reunion), Number(course))}`;
}

export function buildRaceHref(
  reunion: number | string,
  course: number | string,
  dateStr?: string | null,
) {
  const path = buildRacePath(reunion, course);
  return dateStr ? `${path}?date=${dateStr}` : path;
}
