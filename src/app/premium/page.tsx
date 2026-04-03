"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PREMIUM_MONTHLY_PRICE_CURRENCY_SUFFIX,
  PREMIUM_MONTHLY_PRICE_DISPLAY_MAIN,
} from "@/lib/billing-display";

const INCLUDED_FEATURES = [
  {
    title: "Opportunités value filtrées",
    text: "Tu ne vois pas une liste brute. Tu vois seulement les courses où le moteur détecte un vrai décalage avec le marché.",
  },
  {
    title: "Mises Kelly lisibles",
    text: "Chaque pari affiche une mise conseillée, plafonnée et directement exploitable sur une bankroll simple.",
  },
  {
    title: "Tickets optimisés",
    text: "Simple, couplé, trio et quinté ne sortent que si la configuration de course le justifie vraiment.",
  },
  {
    title: "Lecture complète de course",
    text: "Classement détaillé, score de confiance, facteurs clés, ticket conseillé et plan d’action clair.",
  },
  {
    title: "Suivi réel de performance",
    text: "Backtesting, ROI, comparaison contre le hasard et bilan concret de la rentabilité du moteur.",
  },
  {
    title: "Cadre de jeu",
    text: "L’objectif n’est pas de te faire jouer plus. L’objectif est de t’aider à éliminer le bruit plus vite et à rester discipliné.",
  },
];

const FAQ_ITEMS = [
  {
    title: "À qui sert l’abonnement ?",
    text: "À quelqu’un qui veut une lecture actionnable : savoir quoi jouer, quoi ignorer et combien miser sans perdre du temps à trier 40 courses.",
  },
  {
    title: "Est-ce que tout devient premium ?",
    text: "Non. La page d’accueil reste publique. Le premium débloque la lecture complète, les tickets détaillés, les opportunités value et les mises recommandées.",
  },
  {
    title: "Est-ce que l'abonnement garantit un gain ?",
    text: "Non. Le premium vend de la discipline, du filtrage et un moteur plus clair, pas une promesse irréelle de gains automatiques.",
  },
  {
    title: "Peut-on arrêter à tout moment ?",
    text: "Oui. Le portail Stripe permet de gérer ou stopper l’abonnement proprement.",
  },
];

const AUDIENCE_ITEMS = [
  "Tu veux des tickets lisibles et pas une usine à gaz.",
  "Tu veux jouer moins de courses, mais avec plus de conviction.",
  "Tu veux une mise recommandée claire sur bankroll simple.",
  "Tu veux mesurer si le moteur apporte vraiment quelque chose.",
];

const NOT_FOR_YOU_ITEMS = [
  "Tu veux un tipster miracle qui promet de gagner à tous les coups.",
  "Tu veux jouer chaque course de la journée sans filtre.",
  "Tu ne veux ni bankroll, ni discipline, ni suivi.",
];

export default function PremiumPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen bg-[var(--pmu-bg)] text-[var(--pmu-text)]"
      style={{
        background: `radial-gradient(circle at top left, var(--pmu-primary-fade), transparent 32%), radial-gradient(circle at top right, var(--pmu-primary-soft), transparent 28%), var(--pmu-bg)`,
      }}
    >
      <header className="sticky top-0 z-50 border-b border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-bg)_92%,transparent)] backdrop-blur-xl">
        <div className="app-shell flex h-[72px] items-center justify-between gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] text-xl font-black text-[var(--pmu-text)] transition hover:bg-[var(--pmu-surface-highlight)]"
          >
            {"<"}
          </button>
          <div className="text-center">
            <div className="text-[22px] font-black tracking-[-0.03em] text-[var(--pmu-text)]">PMU Gagnant Premium</div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--pmu-primary)]">
              Pronostics complets
            </div>
          </div>
          <Link href="/login?redirect=/mes-paris" className="app-button-primary rounded-full px-4 py-2 text-xs transition hover:opacity-90">
            Se connecter
          </Link>
        </div>
      </header>

      <main className="app-shell grid gap-6 py-6 md:py-8">
        <section className="premium-surface grid gap-5 overflow-hidden rounded-[36px] p-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,360px)] md:p-8">
          <div className="grid gap-5">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--pmu-primary)]">
                Offre premium
              </div>
              <h1 className="max-w-3xl text-[30px] font-black leading-[0.98] tracking-[-0.05em] text-[var(--pmu-text)] sm:text-[36px] md:text-[52px]">
                Tu ne paies pas pour voir plus de courses. Tu paies pour jouer moins, mais mieux.
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[var(--pmu-text-soft)] md:text-[17px]">
                PMU Gagnant Premium filtre le bruit, garde les spots exploitables et transforme l’analyse brute en
                décisions claires : opportunité value, mise conseillée, ticket recommandé et courses à laisser.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[26px] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--pmu-primary)]">
                  Ce que tu vois
                </div>
                <div className="mt-2 text-[18px] font-black text-[var(--pmu-text)]">Pronostics complets, tickets et mises</div>
              </div>
              <div className="rounded-[26px] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--pmu-primary)]">
                  Ce que tu gagnes
                </div>
                <div className="mt-2 text-[18px] font-black text-[var(--pmu-text)]">Moins de bruit, plus de discipline</div>
              </div>
              <div className="rounded-[26px] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--pmu-primary)]">
                  Ce que tu évites
                </div>
                <div className="mt-2 text-[18px] font-black text-[var(--pmu-text)]">Les faux spots et les tickets inutiles</div>
              </div>
            </div>
          </div>

          <aside className="premium-surface grid gap-4 self-start rounded-[32px] p-5 md:p-6">
            <div>
              <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[var(--pmu-primary)]">Tarif</div>
              <div className="mt-3 flex items-end gap-2 text-[var(--pmu-text)]">
                <span className="text-[54px] font-black leading-none tracking-[-0.06em]">
                  {PREMIUM_MONTHLY_PRICE_DISPLAY_MAIN}
                </span>
                <span className="pb-2 text-[16px] font-black">{PREMIUM_MONTHLY_PRICE_CURRENCY_SUFFIX}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-muted)]">
                Accès aux pronostics complets, aux mises recommandées et au suivi réel du moteur.
              </p>
            </div>

            <div className="grid gap-2 rounded-[24px] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
              {[
                "Page d’accueil publique conservée",
                "Pronostics complets réservés aux abonnés",
                "Gestion d'abonnement via Stripe",
                "Arrêt possible à tout moment",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm font-semibold text-[var(--pmu-text-soft)]">
                  <span className="mt-[2px] text-[var(--pmu-primary)]">+</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <Link
              href="/login?redirect=/mes-paris"
              className="app-button-primary block rounded-full px-5 py-4 text-center text-sm transition hover:opacity-90"
            >
              Activer le premium
            </Link>
            <Link
              href="/bilan"
              className="rounded-full border border-[var(--pmu-border-strong)] bg-[var(--pmu-surface)] px-5 py-4 text-center text-sm font-black text-[var(--pmu-text)] transition hover:border-[color-mix(in_srgb,var(--pmu-primary)_40%,transparent)]"
            >
              {`Voir le bilan du moteur`}
            </Link>
            <div className="text-center text-xs font-semibold leading-5 text-[var(--pmu-text-muted)]">
              Paiement sécurisé via Stripe. Le premium t’apporte un cadre de décision plus clair, jamais une promesse de gain.
            </div>
          </aside>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {INCLUDED_FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="premium-surface rounded-[30px] p-5 shadow-[var(--pmu-shadow)]"
            >
              <div className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--pmu-primary)]">Inclus</div>
              <h2 className="mt-3 text-[22px] font-black leading-[1.05] text-[var(--pmu-text)]">{feature.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-muted)]">{feature.text}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
          <div className="dark-surface overflow-hidden rounded-[34px] p-6 md:p-7">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[var(--pmu-primary)]">
              Pour qui
            </div>
            <h2 className="mt-3 text-[28px] font-black leading-[1] tracking-[-0.04em] text-[var(--pmu-text)] md:text-[30px]">
              Une offre utile si tu veux jouer avec un cadre, pas au feeling.
            </h2>
            <div className="mt-5 grid gap-3">
              {AUDIENCE_ITEMS.map((item) => (
                <div key={item} className="rounded-[22px] border border-[var(--pmu-border)] bg-[var(--pmu-surface)] px-4 py-3 text-sm font-semibold text-[var(--pmu-text-soft)]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="premium-surface overflow-hidden rounded-[34px] p-6 md:p-7">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#D64545]">
              {"Ce n'est pas pour toi si"}
            </div>
            <h2 className="mt-3 text-[28px] font-black leading-[1] tracking-[-0.04em] text-white md:text-[30px]">
              Tu cherches une promesse fantasmée plutôt qu’un outil de discipline.
            </h2>
            <div className="mt-5 grid gap-3">
              {NOT_FOR_YOU_ITEMS.map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-[color-mix(in_srgb,var(--pmu-red)_20%,transparent)] bg-[color-mix(in_srgb,var(--pmu-red)_6%,transparent)] px-4 py-3 text-sm font-semibold text-[var(--pmu-text-muted)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="premium-surface overflow-hidden rounded-[34px] p-6 md:p-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[var(--pmu-primary)]">
                Questions fréquentes
              </div>
              <h2 className="mt-2 text-[28px] font-black leading-[1] tracking-[-0.04em] text-[var(--pmu-text)] md:text-[32px]">
                {`Ce que tu dois savoir avant de t’abonner`}
              </h2>
            </div>
            <Link
              href="/login?redirect=/mes-paris"
              className="app-button-primary rounded-full px-5 py-3 text-sm transition hover:opacity-90"
            >
              {`Continuer vers l’offre`}
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {FAQ_ITEMS.map((item) => (
              <article key={item.title} className="rounded-[24px] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-5">
                <h3 className="text-[19px] font-black leading-tight text-[var(--pmu-text)]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-muted)]">{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
