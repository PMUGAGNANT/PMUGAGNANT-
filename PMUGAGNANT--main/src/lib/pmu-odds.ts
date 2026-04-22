export type LiveOddsSource = "PMU_PARTICIPANTS" | "PMU_MASSE_ENJEUX";

export type LiveOddsDetails = {
  numero: number;
  cote: number;
  typePari: string;
  source: LiveOddsSource;
  updatedAtMs: number | null;
  updatedAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function getHorseNumberFromRecord(record: Record<string, unknown>) {
  const candidate =
    record.numPmu ??
    record.numero ??
    record.numeroCheval ??
    record.numCheval ??
    record.num ??
    record.cheval_num ??
    null;
  const parsed = typeof candidate === "number" ? candidate : Number(candidate);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizePmuOddsValue(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return null;
  }

  return value > 100 ? value / 100 : value;
}

export function formatPmuOddsUpdatedAt(ms: unknown) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) {
    return null;
  }

  return new Date(ms).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function parseLiveOddsDetailsFromParticipant(
  raw: Record<string, unknown>
): LiveOddsDetails | null {
  const numero = getHorseNumberFromRecord(raw);
  if (numero === null) return null;

  const dernierRapportDirect = asRecord(raw.dernierRapportDirect);
  const cote = normalizePmuOddsValue(
    dernierRapportDirect.rapport ??
      asRecord(raw.coteDirect).cotePmu ??
      asRecord(raw.rapportDirect).rapport ??
      raw.cotePmu
  );
  if (cote === null) return null;

  const updatedAtMs =
    typeof dernierRapportDirect.dateRapport === "number" &&
    Number.isFinite(dernierRapportDirect.dateRapport)
      ? dernierRapportDirect.dateRapport
      : null;

  return {
    numero,
    cote,
    typePari:
      typeof dernierRapportDirect.typePari === "string"
        ? dernierRapportDirect.typePari
        : "SIMPLE_GAGNANT",
    source: "PMU_PARTICIPANTS",
    updatedAtMs,
    updatedAt: formatPmuOddsUpdatedAt(updatedAtMs),
  };
}

export function buildLiveOddsDetailsFromRecord(
  raw: Record<string, unknown>,
  source: LiveOddsSource
): LiveOddsDetails | null {
  const numero = getHorseNumberFromRecord(raw);
  if (numero === null) return null;

  const cote = normalizePmuOddsValue(
    raw.cote ??
      raw.cotePmu ??
      raw.coteActuelle ??
      raw.coteProbable ??
      asRecord(raw.coteDirect).cotePmu ??
      asRecord(raw.coteDirect).cote ??
      asRecord(raw.dernierRapportDirect).rapport ??
      asRecord(raw.rapportDirect).rapport
  );
  if (cote === null) return null;

  const directReport = asRecord(raw.dernierRapportDirect);
  const updatedAtMs =
    typeof raw.dateRapport === "number"
      ? raw.dateRapport
      : typeof directReport.dateRapport === "number"
        ? directReport.dateRapport
        : null;

  return {
    numero,
    cote,
    typePari:
      typeof raw.typePari === "string"
        ? raw.typePari
        : typeof directReport.typePari === "string"
          ? directReport.typePari
          : "SIMPLE_GAGNANT",
    source,
    updatedAtMs,
    updatedAt: formatPmuOddsUpdatedAt(updatedAtMs),
  };
}

export function formatLiveOddsLabel(details: LiveOddsDetails | null) {
  if (!details) return "Cote stockee";
  if (details.source === "PMU_PARTICIPANTS") {
    return details.updatedAt ? `Cote TURFEDGE ${details.updatedAt}` : "Cote TURFEDGE";
  }
  const pari = details.typePari.includes("PLACE") ? "PLACE" : "GAGNANT";
  return details.updatedAt ? `Cote PMU ${pari} ${details.updatedAt}` : `Cote PMU ${pari}`;
}
