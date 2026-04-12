export interface Bet {
  id: string;
  date_str: string;
  reunion: number;
  course: number;
  hippodrome: string;
  heure_depart: string;
  cheval_num: number;
  cheval_nom: string;
  type_pari: string;
  mise: number;
  cote: number;
  statut: string;
  gain: number | null;
  created_at: string;
}

export type BillingNotice = {
  tone: "success" | "warning" | "loading";
  title: string;
  message: string;
};

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; background: string }
> = {
  EN_ATTENTE: {
    label: "En attente",
    color: "var(--pmu-orange)",
    background: "color-mix(in srgb, var(--pmu-orange) 14%, transparent)",
  },
  GAGNE: {
    label: "Gagne",
    color: "var(--pmu-primary)",
    background: "color-mix(in srgb, var(--pmu-primary) 14%, transparent)",
  },
  PLACE: {
    label: "Place",
    color: "var(--pmu-accent-blue)",
    background: "color-mix(in srgb, var(--pmu-accent-blue) 18%, transparent)",
  },
  PERDU: {
    label: "Perdu",
    color: "var(--pmu-red)",
    background: "color-mix(in srgb, var(--pmu-red) 14%, transparent)",
  },
};

export function formatEuros(value: number) {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} EUR`;
}

export function formatBonusExpiry(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
  }).format(parsed);
}
