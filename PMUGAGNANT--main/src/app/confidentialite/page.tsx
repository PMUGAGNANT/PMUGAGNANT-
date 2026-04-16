import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confidentialité | TurfEdge",
  description: "Données collectées, finalités et services utilisés par TurfEdge.",
};

const PRIVACY_SECTIONS = [
  {
    title: "Compte et authentification",
    text: "L'adresse email, l'identifiant utilisateur et les informations de session servent à ouvrir l'espace personnel, sécuriser les accès premium et associer les tickets au bon compte.",
  },
  {
    title: "Paris simulés et bankroll",
    text: "Les tickets enregistrés dans l'espace Mes Paris servent au suivi personnel, au bilan et aux statistiques de progression. Ils ne constituent pas des paris réels placés par TurfEdge.",
  },
  {
    title: "Paiement",
    text: "Les paiements et abonnements sont traités par Stripe. TurfEdge ne stocke pas les numéros de carte bancaire.",
  },
  {
    title: "Notifications",
    text: "Si tu actives les alertes push, le navigateur transmet une subscription technique utilisée uniquement pour envoyer les signaux TurfEdge.",
  },
  {
    title: "Emails",
    text: "Les emails transactionnels peuvent être envoyés via Resend pour confirmer un abonnement ou transmettre une information liée au compte.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-[58rem] flex-col gap-6 px-4 py-6 md:px-6">
      <section className="app-page-hero p-6 md:p-8">
        <p className="app-kicker">Confidentialité</p>
        <h1 className="mt-3 text-4xl font-black leading-[0.98] text-[var(--pmu-text)] md:text-5xl">
          Des données limitées à l&apos;accès, au paiement et au suivi produit.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
          Cette page résume les données traitées par TurfEdge. Elle doit être
          relue et complétée avec les informations exactes de l&apos;éditeur avant
          lancement public.
        </p>
      </section>

      <section className="grid gap-4">
        {PRIVACY_SECTIONS.map((item) => (
          <article key={item.title} className="app-card p-6">
            <p className="app-kicker">{item.title}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
              {item.text}
            </p>
          </article>
        ))}
      </section>

      <section className="app-card-muted px-5 py-4 text-sm leading-7 text-[var(--pmu-text-soft)]">
        Pour demander une suppression ou une correction de données, utilise
        l&apos;adresse support officielle à renseigner dans les mentions légales.
      </section>
    </div>
  );
}
