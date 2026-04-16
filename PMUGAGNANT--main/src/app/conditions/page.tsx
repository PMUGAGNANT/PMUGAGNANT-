import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions d'utilisation | TurfEdge",
  description: "Conditions d'accès, d'abonnement et d'utilisation de TurfEdge.",
};

const TERMS = [
  {
    title: "Nature du service",
    text: "TurfEdge fournit des analyses, scores, alertes et repères de bankroll pour aider à lire les courses PMU. Le service ne place aucun pari à la place de l'utilisateur.",
  },
  {
    title: "Aucune garantie",
    text: "Un pronostic, même très bien noté, peut perdre. Les performances passées, backtests et statistiques publiques ne garantissent aucun résultat futur.",
  },
  {
    title: "Abonnement",
    text: "L'accès premium débloque la lecture complète, les tickets détaillés et certaines alertes. Le paiement et la gestion de l'abonnement passent par Stripe.",
  },
  {
    title: "Usage raisonnable",
    text: "L'utilisateur reste responsable de ses décisions, de sa bankroll et du respect des règles de jeu responsable.",
  },
  {
    title: "Disponibilité",
    text: "Les données peuvent dépendre de services tiers, de l'accès aux programmes et des horaires de course. Une indisponibilité temporaire ne transforme pas un signal en engagement de résultat.",
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-[58rem] flex-col gap-6 px-4 py-6 md:px-6">
      <section className="app-page-hero p-6 md:p-8">
        <p className="app-kicker">Conditions</p>
        <h1 className="mt-3 text-4xl font-black leading-[0.98] text-[var(--pmu-text)] md:text-5xl">
          Un outil d&apos;aide à la décision, pas une promesse de gain.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
          En utilisant TurfEdge, tu acceptes que les analyses soient des
          informations d&apos;aide à la lecture des courses. Le choix de jouer ou non
          reste toujours personnel.
        </p>
      </section>

      <section className="grid gap-4">
        {TERMS.map((item) => (
          <article key={item.title} className="app-card p-6">
            <p className="app-kicker">{item.title}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
              {item.text}
            </p>
          </article>
        ))}
      </section>

      <section className="app-card-muted px-5 py-4 text-sm leading-7 text-[var(--pmu-text-soft)]">
        Pour les règles de prudence, consulte aussi la page
        <Link href="/jeu-responsable" className="ml-1 font-bold text-[var(--pmu-primary)]">
          Jeu responsable.
        </Link>
      </section>
    </div>
  );
}
