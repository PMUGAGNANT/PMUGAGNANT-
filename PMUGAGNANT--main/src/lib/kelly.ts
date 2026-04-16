export interface KellyInput {
  bankroll: number;
  cote: number;
  confiance: number;
  qualite: number;
  lisibilite: "LISIBLE" | "COMPLEXE" | "LOTERIE";
}

export interface KellyResult {
  mise_kelly: number;
  mise_conseille: number;
  fraction_bankroll: number;
  niveau_risque: "FAIBLE" | "MOYEN" | "ELEVE";
  explication: string;
}

export function calculerKelly(input: KellyInput): KellyResult {
  const prob_base = input.confiance / 10;
  const coeff_lisib =
    input.lisibilite === "LISIBLE" ? 1.0 : input.lisibilite === "COMPLEXE" ? 0.7 : 0;
  const prob_ajustee = prob_base * (input.qualite / 100) * coeff_lisib;
  const b = input.cote - 1;
  const p = prob_ajustee;
  const q = 1 - p;
  const kelly_fraction = b > 0 ? Math.max(0, (b * p - q) / b) : 0;
  const mise_kelly = input.bankroll * kelly_fraction;
  const mise_conseille = Math.max(1, Math.round(mise_kelly / 4));
  const fraction = input.bankroll > 0 ? (mise_conseille / input.bankroll) * 100 : 0;

  return {
    mise_kelly: Math.round(mise_kelly),
    mise_conseille,
    fraction_bankroll: Math.round(fraction * 10) / 10,
    niveau_risque: fraction > 5 ? "ELEVE" : fraction > 2 ? "MOYEN" : "FAIBLE",
    explication: `Sur une bankroll de ${input.bankroll} EUR, miser ${mise_conseille} EUR (${fraction.toFixed(1)}% de ta bankroll)`,
  };
}
