"use client";

import Link from "next/link";
import { ReferralCard } from "@/components/ui/ReferralCard";
import {
  PREMIUM_MONTHLY_PRICE_CURRENCY_SUFFIX,
  PREMIUM_MONTHLY_PRICE_DISPLAY_MAIN,
} from "@/lib/billing-display";

const INCLUDED_FEATURES = [
  {
    title: "Opportunites value filtrees",
    text: "Tu ne vois pas une liste brute. Tu vois seulement les courses ou le moteur detecte un vrai decalage avec le marche.",
  },
  {
    title: "Mises Kelly lisibles",
    text: "Chaque pari affiche une mise conseillee, plafonnee et directement exploitable sur une bankroll simple.",
  },
  {
    title: "Tickets optimises",
    text: "Simple, couple, trio et quinte ne sortent que si la configuration de course le justifie vraiment.",
  },
  {
    title: "Lecture complete de course",
    text: "Classement detaille, score de confiance, facteurs cles, ticket conseille et plan d'action clair.",
  },
  {
    title: "Suivi reel de performance",
    text: "Backtesting, ROI, comparaison contre le hasard et bilan concret de la rentabilite du moteur.",
  },
  {
    title: "Cadre de jeu",
    text: "L'objectif n'est pas de te faire jouer plus. L'objectif est de t'aider a eliminer le bruit plus vite et a rester discipline.",
  },
];

const FAQ_ITEMS = [
  {
    title: "A qui sert l'abonnement ?",
    text: "A quelqu'un qui veut une lecture actionnable : savoir quoi jouer, quoi ignorer et combien miser sans perdre du temps a trier 40 courses.",
  },
  {
    title: "Est-ce que tout devient premium ?",
    text: "Non. La page d'accueil reste publique. Le premium debloque la lecture complete, les tickets detailles, les opportunites value et les mises recommandees.",
  },
  {
    title: "Est-ce que l'abonnement garantit un gain ?",
    text: "Non. Le premium vend de la discipline, du filtrage et un moteur plus clair, pas une promesse irreelle de gains automatiques.",
  },
  {
    title: "Peut-on arreter a tout moment ?",
    text: "Oui. Le portail Stripe permet de gerer ou stopper l'abonnement proprement.",
  },
];

const AUDIENCE_ITEMS = [
  "Tu veux des tickets lisibles et pas une usine a gaz.",
  "Tu veux jouer moins de courses, mais avec plus de conviction.",
  "Tu veux une mise recommandee claire sur bankroll simple.",
  "Tu veux mesurer si le moteur apporte vraiment quelque chose.",
];

const NOT_FOR_YOU_ITEMS = [
  "Tu veux un tipster miracle qui promet de gagner a tous les coups.",
  "Tu veux jouer chaque course de la journee sans filtre.",
  "Tu ne veux ni bankroll, ni discipline, ni suivi.",
];

export default function PremiumPage() {
  const premiumCheckoutRedirect = encodeURIComponent("/mes-paris?billing=checkout");
  const premiumCheckoutHref = `/login?redirect=${premiumCheckoutRedirect}`;

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
      <section className="app-page-hero p-6 md:p-8">
        <div className="relative z-[1] grid gap-6 xl:grid-cols-[1.1fr,0.9fr] xl:items-end">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[var(--pmu-primary-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--pmu-primary)]">
                Offre premium
              </span>
              <span className="app-pill text-xs">Pronostics complets</span>
              <span className="app-pill text-xs">Tickets et mises</span>
            </div>

            <div>
              <p className="app-kicker">Page produit</p>
              <h1 className="max-w-4xl text-4xl font-black leading-[0.93] text-[var(--pmu-text)] md:text-6xl">
                Tu ne paies pas pour voir plus de courses. Tu paies pour jouer moins, mais mieux.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
                PMU Gagnant Premium filtre le bruit, garde les spots exploitables
                et transforme l&apos;analyse brute en decisions claires :
                opportunite value, mise conseillee, ticket recommande et courses
                a laisser.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href={premiumCheckoutHref} className="app-button-primary">
                Se connecter puis payer
              </Link>
              <Link href="/bilan" className="app-button-secondary">
                Voir le bilan du moteur
              </Link>
            </div>
          </div>

          <aside className="app-card p-5 md:p-6">
            <p className="app-kicker">Tarif mensuel</p>
            <div className="mt-4 flex items-end gap-2 text-[var(--pmu-text)]">
              <span className="text-[4rem] font-black leading-none tracking-[-0.06em]">
                {PREMIUM_MONTHLY_PRICE_DISPLAY_MAIN}
              </span>
              <span className="pb-2 text-lg font-black">
                {PREMIUM_MONTHLY_PRICE_CURRENCY_SUFFIX}
              </span>
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
              Acces aux pronostics complets, aux mises recommandees et au suivi
              reel du moteur.
            </p>

            <div className="mt-5 grid gap-3">
              {[
                "Page d'accueil publique conservee",
                "Pronostics complets reserves aux abonnes",
                "Gestion d'abonnement via Stripe",
                "Arret possible a tout moment",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_90%,transparent)] px-4 py-3 text-sm font-semibold text-[var(--pmu-text-soft)]"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1.1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] px-4 py-4 text-sm leading-6 text-[var(--pmu-text-soft)]">
              Paiement securise via Stripe. Le premium t&apos;apporte un cadre de
              decision plus clair, jamais une promesse de gain.
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Ce que tu vois",
            value: "Pronostics complets, tickets et mises",
          },
          {
            label: "Ce que tu gagnes",
            value: "Moins de bruit, plus de discipline",
          },
          {
            label: "Ce que tu evites",
            value: "Les faux spots et les tickets inutiles",
          },
        ].map((item) => (
          <article key={item.label} className="app-card-muted px-5 py-5">
            <p className="app-kicker text-[10px]">{item.label}</p>
            <h2 className="mt-3 text-xl font-black leading-tight text-[var(--pmu-text)]">
              {item.value}
            </h2>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {INCLUDED_FEATURES.map((feature) => (
          <article key={feature.title} className="app-card p-5 md:p-6">
            <p className="app-kicker">Inclus</p>
            <h2 className="mt-3 text-2xl font-black leading-[1.02] text-[var(--pmu-text)]">
              {feature.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
              {feature.text}
            </p>
          </article>
        ))}
      </section>

      <ReferralCard />

      <section className="grid gap-5 xl:grid-cols-[1fr,0.92fr]">
        <section className="app-card p-6 md:p-7">
          <p className="app-kicker">Pour qui</p>
          <h2 className="mt-3 text-3xl font-black leading-[0.98] text-[var(--pmu-text)]">
            Une offre utile si tu veux jouer avec un cadre, pas au feeling.
          </h2>
          <div className="mt-5 grid gap-3">
            {AUDIENCE_ITEMS.map((item) => (
              <div
                key={item}
                className="rounded-[1.1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_90%,transparent)] px-4 py-3 text-sm font-semibold text-[var(--pmu-text-soft)]"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="app-card p-6 md:p-7">
          <p className="app-kicker" style={{ color: "var(--pmu-red)" }}>
            Ce n&apos;est pas pour toi si
          </p>
          <h2 className="mt-3 text-3xl font-black leading-[0.98] text-[var(--pmu-text)]">
            Tu cherches une promesse fantasmee plutot qu&apos;un outil de discipline.
          </h2>
          <div className="mt-5 grid gap-3">
            {NOT_FOR_YOU_ITEMS.map((item) => (
              <div
                key={item}
                className="rounded-[1.1rem] border border-[color-mix(in_srgb,var(--pmu-red)_22%,transparent)] bg-[color-mix(in_srgb,var(--pmu-red)_8%,transparent)] px-4 py-3 text-sm font-semibold text-[var(--pmu-text-soft)]"
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="app-card p-6 md:p-7">
        <div className="app-section-heading">
          <div>
            <p className="app-kicker">Questions frequentes</p>
            <h2 className="app-section-title">
              Ce que tu dois savoir avant de t&apos;abonner
            </h2>
          </div>
          <Link href={premiumCheckoutHref} className="app-button-primary">
            Se connecter puis payer
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {FAQ_ITEMS.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.2rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_92%,transparent)] p-5"
            >
              <h3 className="text-xl font-black leading-tight text-[var(--pmu-text)]">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="app-card p-6 text-center md:p-8">
        <p className="app-kicker">Passer a l&apos;action</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--pmu-text)] md:text-4xl">
          Le premium sert a jouer avec plus de calme et moins de bruit.
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
          Une lecture plus claire, un ticket mieux filtre et une execution plus
          disciplinee.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href={premiumCheckoutHref} className="app-button-primary">
            Se connecter puis payer
          </Link>
          <Link href="/" className="app-button-secondary">
            Retour a l&apos;accueil
          </Link>
        </div>
      </section>
    </div>
  );
}
