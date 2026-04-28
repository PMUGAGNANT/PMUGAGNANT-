"use client";

import Link from "next/link";

import PromoVideo from "@/components/PromoVideo";
import { ReferralCard } from "@/components/ui/ReferralCard";
import { PremiumDecisionStrip } from "@/features/premium/components/PremiumDecisionStrip";
import {
  PREMIUM_MONTHLY_PRICE_CURRENCY_SUFFIX,
  PREMIUM_MONTHLY_PRICE_DISPLAY_MAIN,
} from "@/lib/billing-display";
import { formatLiveRoi, hasLiveStatsData } from "@/lib/live-stats";
import { useLiveStats } from "@/lib/use-live-stats";

const FEATURES = [
  {
    label: "Selection",
    title: "Le cheval exact a jouer",
    text: "Premium revele le cheval recommande, le numero, la cote PMU, la confiance IA et la decision JOUER / PASSER.",
  },
  {
    label: "Mise Kelly",
    title: "La mise conseillee en euros",
    text: "PMU Gagnant calcule une mise lisible sur bankroll 100 EUR avec Kelly 25%, pour garder une gestion de risque propre.",
  },
  {
    label: "Pourquoi",
    title: "3 raisons simples avant de jouer",
    text: "Forme, cote, jockey, terrain, value : l'IA explique la selection en langage clair, sans jargon inutile.",
  },
  {
    label: "Alertes",
    title: "Alertes avant le depart",
    text: "Active les rappels sur les courses prioritaires et evite d'arriver trop tard quand le signal est fort.",
  },
  {
    label: "Bilan reel",
    title: "ROI, gains et pertes suivis",
    text: "Le cockpit montre les mises, les gains, les pertes et les performances par course dans ton historique.",
  },
  {
    label: "Discipline",
    title: "Jouer moins, mieux trier",
    text: "Les courses faibles restent marquees PASSER pour proteger la bankroll et eviter les tickets forces.",
  },
];

const PREMIUM_EXAMPLES = [
  {
    title: "Course jouable",
    horse: "#7 Helios du Val",
    stake: "Mise 10 EUR",
    gain: "Gain potentiel 47 EUR",
    detail: "Confiance 8.1/10, 6 signaux positifs sur 7.",
  },
  {
    title: "Course a eviter",
    horse: "R3C6 - lot trop ouvert",
    stake: "Mise 0 EUR",
    gain: "Bankroll protegee",
    detail: "PMU Gagnant dit PASSER quand le risque est trop haut.",
  },
  {
    title: "Semaine suivie",
    horse: "Tickets valides uniquement",
    stake: "Mises conseillees",
    gain: "Gain reel Supabase",
    detail: "Une lecture simple : argent engage, gain, ROI, resultat.",
  },
];

const TRUST_ITEMS = [
  {
    title: "Les pertes restent visibles",
    text: "Le bilan affiche les mises, les gains, les pertes et le ROI. Une mauvaise serie ne doit jamais etre maquillee.",
  },
  {
    title: "Le bouton PASSER compte autant que JOUER",
    text: "Une course floue doit rester une course evitee. La vraie valeur du service, c'est aussi de reduire les tickets forces.",
  },
  {
    title: "La mise reste cadree",
    text: "Les mises conseillees sont limitees par une logique de bankroll. PMU Gagnant ne pousse pas a augmenter apres une perte.",
  },
];

const COMPARE_ROWS = [
  { feature: "Programme PMU du jour", free: true, premium: true },
  { feature: "Decision JOUER / PASSER", free: "apercu", premium: true },
  { feature: "Cheval conseille par course", free: false, premium: true },
  { feature: "Mise conseillee et gain potentiel", free: false, premium: true },
  { feature: "Explication des signaux positifs", free: false, premium: true },
  { feature: "Alertes T-30 avant depart", free: false, premium: true },
  { feature: "Bilan ROI 7j / 30j / 90j", free: false, premium: true },
  { feature: "Garantie satisfait ou rembourse 7 jours", free: false, premium: true },
  { feature: "Prix mensuel", free: "0 EUR", premium: "offre fondateur" },
];

const FAQ_ITEMS = [
  {
    q: "Est-ce que PMU Gagnant garantit les gains ?",
    a: "Non. Un pari reste risque. PMU Gagnant donne un cadre, une selection et une mise calculee pour jouer avec plus de discipline.",
  },
  {
    q: "Qu'est-ce que je debloque en premium ?",
    a: "Le cheval conseille, la mise, le gain potentiel, les raisons de confiance, les alertes et le bilan complet.",
  },
  {
    q: "Puis-je arreter quand je veux ?",
    a: "Oui. L'abonnement est gere par Stripe et peut etre annule depuis ton espace en quelques clics.",
  },
  {
    q: "Pour qui est fait PMU Gagnant ?",
    a: "Pour les parieurs qui veulent une decision claire, pas un tableau interminable a interpreter.",
  },
];

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="var(--pmu-primary)" />
      <path
        d="M5 8l2 2 4-4"
        stroke="var(--pmu-on-primary)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="var(--pmu-surface-2)" />
      <path d="M10 6L6 10M6 6l4 4" stroke="var(--pmu-text-muted)" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function AvailabilityCell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckIcon />;
  if (value === false) return <CrossIcon />;
  return <span className="text-xs font-bold uppercase text-[var(--pmu-gold)]">{value}</span>;
}

function formatEuros(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PremiumPage() {
  const liveStats = useLiveStats();
  const hasStats = hasLiveStatsData(liveStats.data);
  const checkoutHref = "/mes-paris?billing=checkout";
  const priceLabel = `${PREMIUM_MONTHLY_PRICE_DISPLAY_MAIN} ${PREMIUM_MONTHLY_PRICE_CURRENCY_SUFFIX}`;
  const crossedPriceLabel = "29 EUR / mois";
  const activeSubscribers = liveStats.data.activeSubscribersThisMonth;
  const activeSubscribersLabel = String(activeSubscribers);
  const statCards = hasStats
    ? [
        { value: formatLiveRoi(liveStats.data.roi30d), label: "ROI reel 30 jours" },
        { value: activeSubscribersLabel, label: "abonnes actifs ce mois" },
        { value: String(liveStats.data.totalPredictions), label: "tickets mesures 30j" },
      ]
    : [
        { value: "--", label: "ROI reel 30 jours" },
        { value: activeSubscribersLabel, label: "abonnes actifs ce mois" },
        { value: "--", label: "tickets mesures 30j" },
      ];
  const premiumExamples = PREMIUM_EXAMPLES.map((example) => {
    if (example.title !== "Semaine suivie") {
      return example;
    }

    return {
      ...example,
      gain: hasStats ? `${liveStats.data.netGain7d >= 0 ? "+" : ""}${formatEuros(liveStats.data.netGain7d)}` : "Bilan en cours",
      detail: hasStats
        ? `Calcule sur ${liveStats.data.predictions7d} tickets mesures ces 7 derniers jours.`
        : "Les gains se remplissent automatiquement avec l'historique Supabase.",
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-[70rem] flex-col gap-6 px-4 pb-16">
      <section className="app-page-hero overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[1fr,0.86fr]">
          <div className="p-6 md:p-9">
            <div className="flex flex-wrap gap-2">
              <span className="turf-decision-badge" data-tone="success">
                Premium
              </span>
              <span className="turf-decision-badge" data-tone="warning">
                Offre fondateur limitee
              </span>
            </div>
            <p className="app-kicker mt-6">PMU Gagnant Premium - {activeSubscribersLabel} abonnes actifs ce mois</p>
            <h1 className="mt-3 max-w-3xl text-[2.45rem] font-black leading-[0.95] text-[var(--pmu-text)] md:text-[4.25rem]">
              Les bons parieurs savent surtout quelles courses eviter.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--pmu-text-soft)]">
              Premium transforme chaque course en decision claire : quoi jouer,
              combien miser, pourquoi l&apos;IA est confiante, et quand passer
              pour proteger la bankroll.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href={checkoutHref} className="app-button-primary min-h-12 w-full sm:w-auto">
                Debloquer Premium - {priceLabel}
              </Link>
              <Link href="/bilan" className="app-button-secondary min-h-12 w-full sm:w-auto">
                Voir les gains suivis
              </Link>
            </div>

            <p className="mt-4 text-xs font-semibold text-[var(--pmu-text-muted)]">
              Prix public <span className="line-through">{crossedPriceLabel}</span>. Offre fondateur {priceLabel}. Garantie 7 jours. Aucun pari n&apos;est garanti.
            </p>
          </div>
          <div className="border-t border-[var(--pmu-border)] bg-[var(--pmu-primary-fade)] p-4 lg:border-l lg:border-t-0">
            <PromoVideo />
            <div className="mt-4 rounded-lg border border-[var(--pmu-gold)] bg-[var(--pmu-gold-light)] p-4">
              <p className="app-kicker text-[var(--pmu-gold)]">Offre fondateur</p>
              <p className="mt-2 text-4xl font-black leading-none text-[var(--pmu-text)]">
                {priceLabel}
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--pmu-text-soft)]">
                Prix public <span className="line-through">{crossedPriceLabel}</span>. Garantie 7 jours.
              </p>
              <Link href={checkoutHref} className="app-button-primary mt-4 w-full min-h-12">
                Activer mon acces PRO
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {statCards.map((stat) => (
                <div key={stat.label} className="result-chip px-4 py-3 text-center">
                  <p className="text-2xl font-black text-[var(--pmu-primary)]">{stat.value}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--pmu-text-muted)]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {premiumExamples.map((example) => (
          <article key={example.title} className="app-card p-5">
            <p className="app-kicker">{example.title}</p>
            <h2 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">{example.horse}</h2>
            <div className="mt-5 grid gap-2">
              <div className="stake-chip px-4 py-3">
                <p className="app-label text-[var(--pmu-gold)]">Mise</p>
                <p className="mt-1 text-2xl font-black text-[var(--pmu-text)]">{example.stake}</p>
              </div>
              <div className="result-chip px-4 py-3">
                <p className="app-label">Projection</p>
                <p className="mt-1 text-2xl font-black text-[var(--pmu-primary)]">{example.gain}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--pmu-text-soft)]">{example.detail}</p>
          </article>
        ))}
      </section>

      <PremiumDecisionStrip />

      <section className="app-card p-5 md:p-6">
        <div className="app-section-heading">
          <div>
            <p className="app-kicker">Ce que Premium debloque</p>
            <h2 className="app-section-title">Moins d&apos;hesitation, plus de cadre.</h2>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
              <span className="turf-decision-badge" data-tone="success">
                {feature.label}
              </span>
              <h3 className="mt-3 text-xl font-black leading-tight text-[var(--pmu-text)]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="app-card overflow-hidden p-0">
        <div className="grid grid-cols-[1fr,88px,96px] bg-[var(--pmu-primary)] px-4 py-3 text-xs font-black uppercase text-[var(--pmu-on-primary)] md:grid-cols-[1fr,120px,120px]">
          <span>Fonction</span>
          <span className="text-center">Gratuit</span>
          <span className="text-center text-[var(--pmu-gold-light)]">Premium</span>
        </div>
        {COMPARE_ROWS.map((row, index) => (
          <div
            key={row.feature}
            className={`grid grid-cols-[1fr,88px,96px] items-center border-b border-[var(--pmu-border)] px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr,120px,120px] ${
              index % 2 === 0 ? "bg-[var(--pmu-surface)]" : "bg-[var(--pmu-surface-2)]"
            }`}
          >
            <span className="font-bold text-[var(--pmu-text)]">{row.feature}</span>
            <div className="flex justify-center">
              <AvailabilityCell value={row.free} />
            </div>
            <div className="flex justify-center">
              <AvailabilityCell value={row.premium} />
            </div>
          </div>
        ))}
      </section>

      <section className="app-card p-5 md:p-6">
        <div className="app-section-heading">
          <div>
            <p className="app-kicker">Confiance</p>
            <h2 className="app-section-title">Ce qui doit rester honnete</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {TRUST_ITEMS.map((item) => (
            <article key={item.title} className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
              <h3 className="text-xl font-black leading-tight text-[var(--pmu-text)]">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">{item.text}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--pmu-red)_20%,transparent)] bg-[color-mix(in_srgb,var(--pmu-red)_7%,var(--pmu-surface))] p-4 text-sm font-semibold leading-7 text-[var(--pmu-text-soft)]">
          Le jeu comporte des risques: endettement, isolement, dependance. Fixe une limite avant de jouer et consulte la page jeu responsable si le pari prend trop de place.
          <Link href="/jeu-responsable" className="ml-2 font-black text-[var(--pmu-red)] underline">
            Jeu responsable
          </Link>
        </div>
      </section>

      <section className="app-page-hero p-6 text-center md:p-9">
        <p className="app-kicker">Offre limitee</p>
        <h2 className="mx-auto mt-2 max-w-3xl text-3xl font-black leading-tight text-[var(--pmu-text)] md:text-5xl">
          Les premiers abonnes gardent le tarif fondateur.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)]">
          Premium est fait pour les parieurs qui veulent une decision nette avant
          le depart : JOUER, PASSER, mise, gain potentiel.
        </p>
        <div className="mx-auto mt-5 max-w-xl rounded-[8px] border border-[var(--pmu-gold)] bg-[var(--pmu-gold-light)] px-5 py-4 text-sm font-black text-[var(--pmu-text)]">
          Garantie 7 jours : si PMU Gagnant ne t&apos;aide pas a mieux trier tes courses, remboursement simple.
        </div>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={checkoutHref} className="app-button-primary min-h-12 w-full sm:w-auto">
            Prendre Premium - {priceLabel}
          </Link>
          <Link href="/" className="app-button-secondary min-h-12 w-full sm:w-auto">
            Voir les courses du jour
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[0.9fr,1.1fr]">
        <div>
          <ReferralCard />
        </div>
        <div className="app-card p-5 md:p-6">
          <p className="app-kicker">Questions frequentes</p>
          <div className="mt-4 grid gap-3">
            {FAQ_ITEMS.map((item) => (
              <article key={item.q} className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
                <h3 className="text-base font-black text-[var(--pmu-text)]">{item.q}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
