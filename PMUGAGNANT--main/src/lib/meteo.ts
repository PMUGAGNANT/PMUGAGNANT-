export interface MeteoData {
  description: string;
  temperature: number;
  vent_kmh: number;
  humidite: number;
  terrain_impact: "FAVORABLE" | "NEUTRE" | "DEFAVORABLE";
  alerte: string | null;
}

const HIPPODROMES_GPS: Record<string, { lat: number; lon: number }> = {
  VINCENNES: { lat: 48.844, lon: 2.44 },
  LONGCHAMP: { lat: 48.857, lon: 2.245 },
  AUTEUIL: { lat: 48.856, lon: 2.257 },
  CHANTILLY: { lat: 49.194, lon: 2.47 },
  DEAUVILLE: { lat: 49.361, lon: 0.071 },
  "SAINT-CLOUD": { lat: 48.842, lon: 2.207 },
  "MAISONS-LAFFITTE": { lat: 48.946, lon: 2.148 },
  "LYON-LA-SOIE": { lat: 45.76, lon: 4.92 },
  "MARSEILLE-PONT-DE-VIVAUX": { lat: 43.281, lon: 5.414 },
  "BORDEAUX-LE-BOUSCAT": { lat: 44.868, lon: -0.599 },
  CAGNES: { lat: 43.656, lon: 7.149 },
  "CAGNES-SUR-MER": { lat: 43.656, lon: 7.149 },
  COMPIEGNE: { lat: 49.411, lon: 2.831 },
  ENGHIEN: { lat: 48.973, lon: 2.302 },
  FONTAINEBLEAU: { lat: 48.404, lon: 2.698 },
  LAON: { lat: 49.575, lon: 3.624 },
  LAVAL: { lat: 48.061, lon: -0.774 },
  LEOPARDSTOWN: { lat: 53.267, lon: -6.189 },
  LISIEUX: { lat: 49.144, lon: 0.216 },
  NANTES: { lat: 47.258, lon: -1.515 },
  PAU: { lat: 43.314, lon: -0.353 },
  PONTCHATEAU: { lat: 47.438, lon: -2.088 },
  RAMBOUILLET: { lat: 48.64, lon: 1.84 },
  TOULOUSE: { lat: 43.591, lon: 1.379 },
  VICHY: { lat: 46.141, lon: 3.421 },
};

function normalizeHippodrome(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/^HIPPODROME\s+(DE|DU|D')\s+/u, "")
    .trim();
}

function getGps(hippodrome: string) {
  const normalized = normalizeHippodrome(hippodrome);
  return (
    HIPPODROMES_GPS[normalized] ??
    Object.entries(HIPPODROMES_GPS).find(([key]) => normalized.includes(key))?.[1] ??
    null
  );
}

function weatherDescription(code: number) {
  if ([0, 1].includes(code)) return "Ciel clair";
  if ([2, 3].includes(code)) return "Nuageux";
  if ([45, 48].includes(code)) return "Brouillard";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Pluie";
  if ([71, 73, 75, 85, 86].includes(code)) return "Neige";
  if ([95, 96, 99].includes(code)) return "Orage";
  return "Meteo variable";
}

function terrainImpact(precipitation: number, humidite: number, ventKmh: number) {
  if (precipitation > 5 || humidite > 85) {
    return "DEFAVORABLE" as const;
  }

  if (ventKmh > 40) {
    return "DEFAVORABLE" as const;
  }

  if (precipitation < 2 && humidite < 70) {
    return "FAVORABLE" as const;
  }

  return "NEUTRE" as const;
}

function buildAlert(impact: MeteoData["terrain_impact"], precipitation: number, humidite: number, ventKmh: number) {
  if (impact !== "DEFAVORABLE") return null;
  if (precipitation > 5 || humidite > 85) {
    return "Terrain lourd prevu - verifier preference terrain.";
  }
  if (ventKmh > 40) {
    return "Vent fort prevu - course plus delicate.";
  }
  return "Conditions meteo defavorables.";
}

function findClosestHourIndex(times: string[], heureDepart: string) {
  const [hour = "0", minute = "0"] = heureDepart.split(":");
  const wantedMinutes = Number(hour) * 60 + Number(minute);
  let bestIndex = 0;
  let bestDiff = Number.POSITIVE_INFINITY;

  times.forEach((time, index) => {
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) return;
    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    const diff = Math.abs(currentMinutes - wantedMinutes);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export async function fetchMeteoHippodrome(
  hippodrome: string,
  heure_depart: string
): Promise<MeteoData | null> {
  const gps = getGps(hippodrome);
  if (!gps) return null;

  try {
    const params = new URLSearchParams({
      latitude: String(gps.lat),
      longitude: String(gps.lon),
      hourly: "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
      forecast_days: "2",
      timezone: "Europe/Paris",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: 900 },
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      hourly?: {
        time?: string[];
        temperature_2m?: number[];
        relative_humidity_2m?: number[];
        precipitation?: number[];
        weather_code?: number[];
        wind_speed_10m?: number[];
      };
    };
    const times = payload.hourly?.time ?? [];
    if (times.length === 0) return null;

    const index = findClosestHourIndex(times, heure_depart);
    const temperature = Math.round(payload.hourly?.temperature_2m?.[index] ?? 0);
    const ventKmh = Math.round(payload.hourly?.wind_speed_10m?.[index] ?? 0);
    const humidite = Math.round(payload.hourly?.relative_humidity_2m?.[index] ?? 0);
    const precipitation = payload.hourly?.precipitation?.[index] ?? 0;
    const code = payload.hourly?.weather_code?.[index] ?? 0;
    const impact = terrainImpact(precipitation, humidite, ventKmh);

    return {
      description: weatherDescription(code),
      temperature,
      vent_kmh: ventKmh,
      humidite,
      terrain_impact: impact,
      alerte: buildAlert(impact, precipitation, humidite, ventKmh),
    };
  } catch {
    return null;
  }
}
