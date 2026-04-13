"use client";

import Link from "next/link";

import { ReferralCard } from "@/components/ui/ReferralCard";
import {
  PREMIUM_MONTHLY_PRICE_CURRENCY_SUFFIX,
  PREMIUM_MONTHLY_PRICE_DISPLAY_MAIN,
} from "@/lib/billing-display";

const INCLUDED_FEATURES = [
  {
    icon: "🎯",
    title: "Opportunités value filtrées",
    text: "Le moteur isole les courses où le prix semble décalé par rapport au risque réel.",
  },
  {
    icon: "💶",
    title: "Mises Kelly lisibles",
    text: "Chaque signal reçoit une mise conseillée, plafonnée et simple à appliquer sur ta bankroll.",
  },
  {
    icon: "🧾",
    title: "Tickets optimisés",
    text: "Simple, couplé, trio et quinté sortent seulement quand la configuration le justifie.",
  },
  {
    icon: "🐎",
    title: "Lecture complète de course",
    text: "Score de confiance, cheval retenu, facteurs clés, rôles et plan d'action sont regroupés.",
  },
  {
    icon: "📈",
    title: "Suivi réel de performance",
    text: "Historique, ROI, résultats et discipline de jeu restent visibles pour juger le moteur.",
  },
  {
    icon: "🛡️",
    title: "Cadre de jeu",
    text: "L'objectif est de jouer moins de courses, avec plus de calme et plus de méthode.",
  },
];

const COMPARISON_ROWS = [
  ["Programme du jour", "✓", "✓"],
  ["Score journée", "✓", "✓"],
  ["Ticket détaillé", "-", "✓"],
  ["4 rôles chevaux", "-", "✓"],
  ["Avis expert top 5", "Partiel", "✓ complet"],
  ["Kelly / mise conseillée", "-", "✓"],
  ["Alerte T-10min", "-", "✓"],
  ["Combo courses", "-", "✓"],
  ["Historique performances", "-", "✓"],
];

const FAQ_ITEMS = [
  {
    title: "À qui sert l'abonnement ?",
    text: "À quelqu'un qui veut savoir quoi jouer, quoi ignorer et combien miser sans passer sa journée à trier le programme.",
  },
  {
    title: "Est-ce que tout devient premium ?",
    text: "Non. Le programme reste public. Le premium débloque la lecture complète, les tickets détaillés, les opportunités value et les mises recommandées.",
  },
  {
    title: "Est-ce que l'abonnement garantit un gain ?",
    text: "Non. TurfEdge apporte du filtrage, une méthode et une lecture plus claire. Aucun outil sérieux ne promet un gain automatique.",
  },
  {
    title: "Peut-on arrêter à tout moment ?",
    text: "Oui. Le portail Stripe permet de gérer ou stopper l'abonnement proprement.",
  },
];

export default function PremiumPage() {
  const premiumCheckoutRedirect = encodeURIComponent("/mes-paris?billing=checkout");
  const premiumCheckoutHref = `/login?redirect=${premiumCheckoutRedirect}`;
  const priceLabel = `${PREMIUM_MONTHLY_PRICE_DISPLAY_MAIN} ${PREMIUM_MONTHLY_PRICE_CURRENCY_SUFFIX}`;

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
      <section
        className="px-6 py-14 text-center md:px-10 md:py-16"
        style={{ background: "var(--pmu-primary)", color: "var(--pmu-on-primary)" }}
      >
        <p className="text-sm font-bold uppercase opacity-75">TurfEdge Premium</p>
        <h1
          className="mx-auto mt-3 max-w-4xl font-[family-name:var(--font-display)] text-5xl font-bold italic leading-none md:text-6xl"
          style={{ color: "var(--pmu-on-primary)" }}
        >
          L&apos;intelligence du terrain.
          <br />
          Enfin actionnable.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-8 opacity-85 md:text-lg">
          Chaque matin, le moteur lit toutes les courses du jour et te dit quoi
          jouer, quoi ignorer, et combien miser.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={premiumCheckoutHref}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--pmu-on-primary)] bg-[var(--pmu-on-primary)] px-8 py-4 text-base font-bold text-[var(--pmu-primary)]"
          >
            Commencer - {priceLabel}/mois
          </Link>
          <a
            href="#fonctionnalites"
            className="inline-flex items-center justify-center rounded-lg border border-[rgba(255,255,255,0.32)] px-6 py-4 text-base font-semibold"
          >
            Voir ce qui est inclus
          </a>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4 md:grid-cols-3">
        {[
          ["3 courses", "en moyenne à travailler par jour"],
          ["+8.3%", "ROI semaine affiché dans le desk"],
          ["95%", "du bruit retiré avant décision"],
        ].map(([value, label]) => (
          <div key={value} className="text-center">
            <p className="font-[family-name:var(--font-display)] text-4xl font-bold text-[var(--pmu-primary)]">
              {value}
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--pmu-text-soft)]">
              {label}
            </p>
          </div>
        ))}
      </section>

      <section id="fonctionnalites" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {INCLUDED_FEATURES.map((feature) => (
          <article key={feature.title} className="app-card p-5 md:p-6">
            <span className="text-2xl" aria-hidden>
              {feature.icon}
            </span>
            <h2 className="mt-4 text-2xl font-black leading-tight text-[var(--pmu-text)]">
              {feature.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
              {feature.text}
            </p>
          </article>
        ))}
      </section>

      <section className="app-card overflow-hidden">
        <div className="border-b border-[var(--pmu-border)] px-5 py-5 md:px-6">
          <p className="app-kicker">Gratuit vs Premium</p>
          <h2 className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
            Ce que tu débloques réellement
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="app-table min-w-[720px]">
            <thead>
              <tr>
                <th>Fonctionnalité</th>
                <th>Gratuit</th>
                <th>Premium</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map(([feature, free, premium]) => (
                <tr key={feature}>
                  <td className="font-semibold text-[var(--pmu-text)]">{feature}</td>
                  <td>{free}</td>
                  <td className="font-black text-[var(--pmu-primary)]">{premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ReferralCard />

      <section className="app-card p-6 text-center md:p-8">
        <p className="app-kicker">Passer à l&apos;action</p>
        <h2 className="mx-auto mt-2 max-w-3xl text-4xl font-black leading-tight text-[var(--pmu-text)]">
          Joue moins de courses. Garde les vraies décisions.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--pmu-text-soft)]">
          {priceLabel}/mois. Annulable à tout moment depuis Stripe.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={premiumCheckoutHref} className="app-button-primary">
            Débloquer Premium
          </Link>
          <Link href="/" className="app-button-secondary">
            Retour au programme
          </Link>
        </div>
      </section>

      <section className="app-card p-5 md:p-6">
        <p className="app-kicker">Questions fréquentes</p>
        <h2 className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
          Avant de t&apos;abonner
        </h2>
        <div className="mt-5 grid gap-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.title}
              className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-4 py-3"
            >
              <summary className="cursor-pointer text-base font-black text-[var(--pmu-text)]">
                {item.title}
              </summary>
              <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
                {item.text}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
