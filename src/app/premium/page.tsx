"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const INCLUDED_FEATURES = [
  {
    title: "Value bets filtres",
    text: "Tu ne vois pas une liste brute. Tu vois seulement les spots ou l'algo detecte un vrai edge contre le marche.",
  },
  {
    title: "Mises Kelly lisibles",
    text: "Chaque pari affiche une mise conseillee, capee et exploitable sur une bankroll simple.",
  },
  {
    title: "Tickets optimises",
    text: "Simple, couple, trio et quinte ne sortent que si la configuration de course le justifie vraiment.",
  },
  {
    title: "Lecture complete de course",
    text: "Classement detaille, score de confiance, raisons du score, value ou eviter, et plan d'action net.",
  },
  {
    title: "Suivi reel de performance",
    text: "Backtesting, ROI, comparaison contre le hasard et bilan concret de la rentabilite de l'algo.",
  },
  {
    title: "Flux discipline",
    text: "L'objectif n'est pas de te faire jouer plus. L'objectif est de te faire eliminer le bruit plus vite.",
  },
];

const FAQ_ITEMS = [
  {
    title: "A qui sert l'abonnement ?",
    text: "A quelqu'un qui veut une lecture actionnable: savoir quoi jouer, quoi ignorer et combien miser sans perdre du temps a trier 40 courses.",
  },
  {
    title: "Est-ce que tout devient premium ?",
    text: "Non. La home reste publique. Le premium debloque la lecture complete, les tickets detailles, les value bets et les mises recommandees.",
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
  "Tu veux mesurer si l'algo apporte vraiment quelque chose.",
];

const NOT_FOR_YOU_ITEMS = [
  "Tu veux un tipster miracle qui promet de gagner a tous les coups.",
  "Tu veux jouer chaque course de la journee sans filtre.",
  "Tu ne veux ni bankroll, ni discipline, ni suivi.",
];

export default function PremiumPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(0,132,61,0.16), transparent 24%), radial-gradient(circle at top right, rgba(18,183,106,0.12), transparent 20%), linear-gradient(180deg, #f6f8f9 0%, #edf2f3 100%)",
      }}
    >
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(18,22,26,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] w-[min(1180px,calc(100%-24px))] items-center justify-between gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl font-black text-white transition hover:bg-white/14"
          >
            {"<"}
          </button>
          <div className="text-center">
            <div className="text-[22px] font-black tracking-[-0.03em] text-white">PMU AI Premium</div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6CE4A0]">
              Pronostics complets
            </div>
          </div>
          <Link
            href="/login?redirect=/mes-paris"
            className="rounded-full bg-[#6CE4A0] px-4 py-2 text-xs font-black text-[#102419] transition hover:bg-[#5bd08e]"
          >
            Se connecter
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-[min(1180px,calc(100%-24px))] gap-6 py-6 md:py-8">
        <section className="grid gap-5 rounded-[36px] bg-[linear-gradient(135deg,#132126,#18242a)] p-6 text-white shadow-[0_30px_60px_rgba(15,23,42,0.18)] md:grid-cols-[minmax(0,1.15fr)_360px] md:p-8">
          <div className="grid gap-5">
            <div>
              <div className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6CE4A0]">
                Offre premium
              </div>
              <h1 className="max-w-3xl text-[34px] font-black leading-[0.98] tracking-[-0.05em] md:text-[52px]">
                Tu ne paies pas pour voir plus de courses. Tu paies pour jouer moins, mais mieux.
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/76 md:text-[17px]">
                PMU AI Premium filtre le bruit, garde les spots exploitables et transforme l&apos;analyse brute
                en decisions claires: value bet, mise conseillee, ticket recommande et course a eviter.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[26px] border border-white/10 bg-white/8 p-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#6CE4A0]">
                  Ce que tu vois
                </div>
                <div className="mt-2 text-[18px] font-black">Value bets, tickets, mises et alertes</div>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/8 p-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#6CE4A0]">
                  Ce que tu gagnes
                </div>
                <div className="mt-2 text-[18px] font-black">Moins de bruit, plus de discipline</div>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/8 p-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#6CE4A0]">
                  Ce que tu evites
                </div>
                <div className="mt-2 text-[18px] font-black">Les faux spots et les tickets inutiles</div>
              </div>
            </div>
          </div>

          <aside className="premium-surface grid gap-4 self-start rounded-[32px] p-5 md:p-6">
            <div>
              <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#0b8f4d]">
                Tarif
              </div>
              <div className="mt-3 flex items-end gap-2 text-[#171b1f]">
                <span className="text-[54px] font-black leading-none tracking-[-0.06em]">14,99</span>
                <span className="pb-2 text-[16px] font-black">EUR / mois</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#5B6472]">
                Acces aux pronostics complets, aux mises recommandees et au suivi reel de l&apos;algo.
              </p>
            </div>

            <div className="grid gap-2 rounded-[24px] bg-[#F5FAF6] p-4">
              {[
                "Page d'accueil publique conservee",
                "Pronostics complets reserves aux abonnes",
                "Gestion d'abonnement via Stripe",
                "Arret possible a tout moment",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm font-semibold text-[#24303C]">
                  <span className="mt-[2px] text-[#0b8f4d]">+</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <Link
              href="/login?redirect=/mes-paris"
              className="rounded-full bg-[#0b8f4d] px-5 py-4 text-center text-sm font-black text-white transition hover:bg-[#08703d]"
            >
              Activer le premium
            </Link>
            <Link
              href="/bilan"
              className="rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-5 py-4 text-center text-sm font-black text-[#171b1f] transition hover:bg-[#F8FAFB]"
            >
              Voir le bilan de l&apos;algo
            </Link>
            <div className="text-center text-xs font-semibold leading-5 text-[#7A8A9A]">
              Paiement securise via Stripe. Le premium te donne une lecture plus exploitable, pas une promesse magique.
            </div>
          </aside>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {INCLUDED_FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="premium-surface rounded-[30px] p-5 shadow-[0_18px_34px_rgba(15,23,42,0.07)]"
            >
              <div className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#0b8f4d]">
                Inclus
              </div>
              <h2 className="mt-3 text-[22px] font-black leading-[1.05] text-[#171b1f]">{feature.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#5B6472]">{feature.text}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
          <div className="dark-surface rounded-[34px] p-6 text-white md:p-7">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#6CE4A0]">
              Pour qui
            </div>
            <h2 className="mt-3 text-[30px] font-black leading-[1] tracking-[-0.04em]">
              Une offre utile si tu veux jouer avec un cadre, pas au feeling.
            </h2>
            <div className="mt-5 grid gap-3">
              {AUDIENCE_ITEMS.map((item) => (
                <div key={item} className="rounded-[22px] border border-white/8 bg-white/8 px-4 py-3 text-sm font-semibold text-white/84">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="premium-surface rounded-[34px] p-6 md:p-7">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#D64545]">
              Ce n&apos;est pas pour toi si
            </div>
            <h2 className="mt-3 text-[30px] font-black leading-[1] tracking-[-0.04em] text-[#171b1f]">
              Tu cherches une promesse fantasmee plutot qu&apos;un outil de discipline.
            </h2>
            <div className="mt-5 grid gap-3">
              {NOT_FOR_YOU_ITEMS.map((item) => (
                <div key={item} className="rounded-[22px] border border-[rgba(214,69,69,0.12)] bg-[#FFF7F6] px-4 py-3 text-sm font-semibold text-[#5B6472]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="premium-surface rounded-[34px] p-6 md:p-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#0b8f4d]">
                Questions frequentes
              </div>
              <h2 className="mt-2 text-[32px] font-black leading-[1] tracking-[-0.04em] text-[#171b1f]">
                Ce que tu dois savoir avant de t&apos;abonner
              </h2>
            </div>
            <Link
              href="/login?redirect=/mes-paris"
              className="rounded-full bg-[#171b1f] px-5 py-3 text-sm font-black text-white transition hover:bg-[#242a30]"
            >
              Continuer vers l&apos;offre
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {FAQ_ITEMS.map((item) => (
              <article key={item.title} className="rounded-[24px] border border-[rgba(15,23,42,0.06)] bg-white p-5">
                <h3 className="text-[19px] font-black leading-tight text-[#171b1f]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#5B6472]">{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
