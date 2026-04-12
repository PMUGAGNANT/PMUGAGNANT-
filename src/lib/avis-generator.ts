import Anthropic from "@anthropic-ai/sdk";

export type AvisVerdict = "MISER" | "SURVEILLER" | "EVITER";
export type AvisPariType = "GAGNANT" | "PLACE";

export interface ChevalPourAvis {
  cheval_nom: string;
  cheval_num: number;
  cote_matin: number;
  score_cheval: number;
  confiance: number;
  qualite: number;
  lisibilite: "LISIBLE" | "COMPLEXE" | "LOTERIE";
  decision: "VALIDE" | "SURVEILLANCE" | "REJET";
  value: number;
  performances_recentes: string;
  hippodrome: string;
  distance: number;
  discipline: string;
  entraineur?: string;
  jockey?: string;
}

export interface AvisGenere {
  note: number;
  verdict: AvisVerdict;
  pari_type: AvisPariType;
  texte: string | null;
}

export interface AvisExpertPrediction {
  cheval_num: number;
  cheval_nom: string;
  cote_matin: number | null;
  score_cheval: number;
  confiance: number;
  value: number | null;
  avis_texte: string | null;
  avis_note: number | null;
  avis_verdict: AvisVerdict | null;
  avis_pari_type: AvisPariType | null;
  avis_generated_at?: string | null;
  performances_recentes?: string | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function stripFinalPunctuation(value: string) {
  return value.trim().replace(/[.!?;:]+$/u, "");
}

export function calculerNote(cheval: ChevalPourAvis): number {
  let note = cheval.confiance;

  if (cheval.lisibilite === "LISIBLE") note += 0.3;
  if (cheval.lisibilite === "LOTERIE") note -= 1.5;
  if (cheval.value >= 2.0) note += 0.3;
  if (cheval.value >= 3.5) note += 0.2;
  if (cheval.qualite >= 80) note += 0.2;
  if (cheval.qualite < 60) note -= 0.5;

  return clamp(Math.round(note * 10) / 10, 1, 10);
}

export function calculerVerdict(
  note: number,
  lisibilite: string,
  decision: string
): { verdict: AvisVerdict; pari_type: AvisPariType } {
  if (lisibilite === "LOTERIE" || note < 5.0) {
    return { verdict: "EVITER", pari_type: "PLACE" };
  }

  if (decision === "VALIDE" && note >= 7.0 && lisibilite === "LISIBLE") {
    return { verdict: "MISER", pari_type: note >= 8.0 ? "GAGNANT" : "PLACE" };
  }

  if (note >= 6.0) {
    return { verdict: "SURVEILLER", pari_type: "PLACE" };
  }

  return { verdict: "EVITER", pari_type: "PLACE" };
}

export async function genererAvisTexte(
  cheval: ChevalPourAvis
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const client = new Anthropic({ apiKey });
  const prompt = `Tu es un expert turf qui redige des avis sur les chevaux pour un journal hippique professionnel.

Cheval : ${cheval.cheval_nom} (N${cheval.cheval_num})
Hippodrome : ${cheval.hippodrome}
Distance : ${cheval.distance}m
Discipline : ${cheval.discipline}
Cote : ${cheval.cote_matin}
Performances recentes : ${cheval.performances_recentes}
Score algo : ${cheval.score_cheval}/100
Confiance : ${cheval.confiance}/10
Lisibilite course : ${cheval.lisibilite}
${cheval.entraineur ? `Entraineur : ${cheval.entraineur}` : ""}
${cheval.jockey ? `Jockey : ${cheval.jockey}` : ""}

Redige UN avis de 1 a 2 phrases MAXIMUM dans le style d'un expert turf de journal hippique.
Style : factuel, confiant, direct. Mention des performances recentes si pertinent.
Met en valeur 1 point fort et 1 signal cle.
Ne commence JAMAIS par le nom du cheval.
Ne depasse jamais 180 caracteres.
Reponds UNIQUEMENT avec le texte de l'avis, sans guillemets ni ponctuation finale.`;

  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0];
    if (!text || text.type !== "text") {
      return null;
    }

    return stripFinalPunctuation(text.text).slice(0, 180) || null;
  } catch (error) {
    console.error("Erreur generation avis Claude:", error);
    return null;
  }
}

export async function genererAvisComplet(
  cheval: ChevalPourAvis
): Promise<AvisGenere> {
  const note = calculerNote(cheval);
  const { verdict, pari_type } = calculerVerdict(
    note,
    cheval.lisibilite,
    cheval.decision
  );
  const texte = await genererAvisTexte(cheval);

  return { note, verdict, pari_type, texte };
}
