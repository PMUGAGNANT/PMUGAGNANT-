import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales | TurfEdge",
  description: "Informations d'édition et d'hébergement de TurfEdge.",
};

const LEGAL_ROWS = [
  {
    label: "Éditeur",
    value: "À compléter avant lancement public : nom légal, forme juridique, adresse et numéro d'immatriculation.",
  },
  {
    label: "Contact",
    value: "À compléter avec l'adresse email support officielle du service.",
  },
  {
    label: "Hébergement",
    value: "Application prévue pour un hébergement Vercel avec stockage Supabase.",
  },
  {
    label: "Marque",
    value: "TurfEdge est le nom public utilisé par l'interface et les communications produit.",
  },
];

export default function LegalNoticePage() {
  return (
    <div className="mx-auto flex w-full max-w-[58rem] flex-col gap-6 px-4 py-6 md:px-6">
      <section className="app-page-hero p-6 md:p-8">
        <p className="app-kicker">Mentions légales</p>
        <h1 className="mt-3 text-4xl font-black leading-[0.98] text-[var(--pmu-text)] md:text-5xl">
          Informations à publier avant ouverture officielle.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
          Cette page centralise les informations légales du service. Les champs
          éditeur et contact doivent être remplacés par les informations réelles
          avant une mise en production commerciale.
        </p>
      </section>

      <section className="app-card p-6 md:p-7">
        <div className="grid gap-3">
          {LEGAL_ROWS.map((row) => (
            <article key={row.label} className="app-card-muted px-4 py-4">
              <p className="app-label">{row.label}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--pmu-text-soft)]">
                {row.value}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="app-card-muted px-5 py-4 text-sm leading-7 text-[var(--pmu-text-soft)]">
        TurfEdge n&apos;est pas affilié au PMU. Les noms de courses, hippodromes et
        rapports publics servent uniquement à la lecture sportive et statistique.
      </section>
    </div>
  );
}
