"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
    icon: "🎯",
    label: "Selection",
    title: "Le cheval exact à jouer",
    text: "Premium révèle le cheval recommandé, le numéro, la cote PMU, la confiance IA et la décision JOUER / PASSER.",
  },
  {
    icon: "💶",
    label: "Mise Kelly",
    title: "La mise conseillée en euros",
    text: "TurfEdge calcule une mise lisible sur bankroll 100 EUR avec Kelly 25%, pour garder une gestion de risque propre.",
  },
  {
    icon: "💡",
    label: "Pourquoi",
    title: "3 raisons simples avant de jouer",
    text: "Forme, cote, jockey, terrain, value : l'IA explique la sélection en langage clair, sans jargon inutile.",
  },
  {
    icon: "🔔",
    label: "Alertes",
    title: "Alertes avant le départ",
    text: "Active les rappels sur les courses prioritaires et évite d'arriver trop tard quand le signal est fort.",
  },
  {
    icon: "📈",
    label: "Bilan réel",
    title: "ROI, gains et pertes suivis",
    text: "Le cockpit montre les mises, les gains, les pertes et les performances par course dans ton historique.",
  },
  {
    icon: "🛡️",
    label: "Discipline",
    title: "Jouer moins, mieux trier",
    text: "Les courses faibles restent marquées PASSER pour protéger la bankroll et éviter les tickets forcés.",
  },
];

const PREMIUM_EXAMPLES = [
  {
    tone: "play",
    title: "Course jouable",
    badge: "JOUER",
    horse: "#7 Helios du Val",
    stake: "10 €",
    gain: "47 €",
    detail: "Confiance 8.1/10 · 6 signaux positifs sur 7",
  },
  {
    tone: "pass",
    title: "Course à éviter",
    badge: "PASSER",
    horse: "R3C6 — lot trop ouvert",
    stake: "0 €",
    gain: "Bankroll protégée",
    detail: "TurfEdge dit PASSER quand le risque est trop haut",
  },
  {
    tone: "track",
    title: "Semaine suivie",
    badge: "BILAN",
    horse: "Tickets validés uniquement",
    stake: "Mises conseillées",
    gain: null,
    detail: "Une lecture simple : argent engagé, gain, ROI, résultat.",
  },
];

const TESTIMONIALS = [
  {
    stars: 5,
    quote: "Je regarde le verdict, la mise, puis les trois raisons. En 20 secondes je sais si je joue ou si je passe.",
    name: "Marc",
    location: "Île-de-France · Parieur trot",
  },
  {
    stars: 5,
    quote: "Le vrai gain pour moi, c'est d'éviter les courses pièges. Le bouton PASSER m'a fait économiser beaucoup de tickets inutiles.",
    name: "Nadia",
    location: "Nantes · Joueuse Quinté",
  },
  {
    stars: 5,
    quote: "Je ne suis pas expert data. Le bilan me montre juste ce que j'ai misé, ce qui est revenu, et si je progresse.",
    name: "Julien",
    location: "Bordeaux · Abonné 3 mois",
  },
];

const COMPARE_ROWS = [
  { feature: "Programme PMU du jour", free: true, premium: true },
  { feature: "Décision JOUER / PASSER", free: "aperçu", premium: true },
  { feature: "Cheval conseillé par course", free: false, premium: true },
  { feature: "Mise conseillée et gain potentiel", free: false, premium: true },
  { feature: "Explication des signaux positifs", free: false, premium: true },
  { feature: "Alertes T-30 avant départ", free: false, premium: true },
  { feature: "Bilan ROI 7j / 30j / 90j", free: false, premium: true },
  { feature: "Groupe Telegram privé", free: false, premium: true },
  { feature: "Garantie satisfait ou remboursé 7 jours", free: false, premium: true },
  { feature: "Prix mensuel", free: "0 €", premium: "offre fondateur" },
];

const FAQ_ITEMS = [
  {
    q: "Est-ce que TurfEdge garantit les gains ?",
    a: "Non. Un pari reste risqué. TurfEdge donne un cadre, une sélection et une mise calculée pour jouer avec plus de discipline.",
  },
  {
    q: "Qu'est-ce que je débloque en premium ?",
    a: "Le cheval conseillé, la mise, le gain potentiel, les raisons de confiance, les alertes et le bilan complet.",
  },
  {
    q: "Puis-je arrêter quand je veux ?",
    a: "Oui. L'abonnement est géré par Stripe et peut être annulé depuis ton espace en quelques clics.",
  },
  {
    q: "Pour qui est fait TurfEdge ?",
    a: "Pour les parieurs qui veulent une décision claire, pas un tableau interminable à interpréter.",
  },
  {
    q: "C'est quoi l'offre fondateur ?",
    a: "Les premiers abonnés bénéficient d'un tarif réduit garanti tant qu'ils restent abonnés. Le prix public sera supérieur pour les nouveaux inscrits.",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} étoiles sur 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill={i < count ? "var(--pmu-gold)" : "var(--pmu-border)"} aria-hidden>
          <path d="M7 1l1.5 3.5L12 5l-2.5 2.5.5 3.5L7 9.5 4 11l.5-3.5L2 5l3.5-.5L7 1z" />
        </svg>
      ))}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="var(--pmu-primary)" />
      <path d="M5 8l2 2 4-4" stroke="var(--pmu-on-primary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
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
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function StickyCtaBar({ href, label }: { href: string; label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--pmu-border)] bg-[var(--pmu-surface)]/95 px-4 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[var(--pmu-text)]">{label}</p>
          <p className="text-xs text-[var(--pmu-text-muted)]">Garantie 7 jours · Annulation libre</p>
        </div>
        <Link href={href} className="app-button-primary shrink-0 !py-2.5 !text-sm">
          Activer PRO
        </Link>
      </div>
    </div>
  );
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
        { value: formatLiveRoi(liveStats.data.roi30d), label: "ROI réel 30 jours" },
        { value: activeSubscribersLabel, label: "abonnés actifs ce mois" },
        { value: String(liveStats.data.totalPredictions), label: "tickets mesurés 30j" },
      ]
    : [
        { value: "--", label: "ROI réel 30 jours" },
        { value: activeSubscribersLabel, label: "abonnés actifs ce mois" },
        { value: "--", label: "tickets mesurés 30j" },
      ];

  const weeklyGain = hasStats
    ? `${liveStats.data.netGain7d >= 0 ? "+" : ""}${formatEuros(liveStats.data.netGain7d)}`
    : "Bilan en cours";

  const weeklyDetail = hasStats
    ? `Calculé sur ${liveStats.data.predictions7d} tickets mesurés ces 7 derniers jours.`
    : "Les gains se remplissent automatiquement avec l'historique.";

  return (
    <>
      <StickyCtaBar href={checkoutHref} label={`Premium ${priceLabel}`} />

      <div className="mx-auto flex w-full max-w-[70rem] flex-col gap-6 px-4 pb-24 lg:pb-16">

        {/* Hero */}
        <section className="app-page-hero overflow-hidden p-0">
          <div className="grid gap-0 lg:grid-cols-[1fr,0.86fr]">
            <div className="p-6 md:p-9">
              <div className="flex flex-wrap gap-2">
                <span className="turf-decision-badge" data-tone="success">Premium</span>
                <span className="turf-decision-badge" data-tone="warning">Offre fondateur limitée</span>
              </div>
              <p className="app-kicker mt-6">TurfEdge Premium · {activeSubscribersLabel} abonnés actifs</p>
              <h1 className="mt-3 max-w-3xl text-[2.2rem] font-black leading-[0.95] text-[var(--pmu-text)] md:text-[3.8rem]">
                Les parieurs qui gagnent utilisent TurfEdge.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--pmu-text-soft)]">
                Premium transforme chaque course en décision claire : quoi jouer,
                combien miser, pourquoi l&apos;IA est confiante, et quand passer sans regret.
              </p>

              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {["Cheval conseillé + mise Kelly", "Alertes T-30 avant départ", "Bilan ROI complet", "Groupe Telegram privé"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm font-semibold text-[var(--pmu-text)]">
                    <CheckIcon />{item}
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href={checkoutHref} className="app-button-primary min-h-12 w-full sm:w-auto">
                  Débloquer Premium · {priceLabel}
                </Link>
                <Link href="/bilan" className="app-button-secondary min-h-12 w-full sm:w-auto">
                  Voir les gains suivis
                </Link>
              </div>

              <p className="mt-4 text-xs font-semibold text-[var(--pmu-text-muted)]">
                Prix public <span className="line-through">{crossedPriceLabel}</span> · Offre fondateur {priceLabel} · Garantie satisfait ou remboursé 7 jours.
              </p>
            </div>

            <div className="border-t border-[var(--pmu-border)] bg-[var(--pmu-primary-fade)] p-4 lg:border-l lg:border-t-0">
              <PromoVideo />
              <div className="mt-4 rounded-xl border border-[var(--pmu-gold)] bg-[var(--pmu-gold-light)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="app-kicker text-[var(--pmu-gold)]">Offre fondateur</p>
                    <p className="mt-1 text-4xl font-black leading-none text-[var(--pmu-text)]">{priceLabel}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--pmu-text-soft)]">
                      Prix public <span className="line-through">{crossedPriceLabel}</span> · Garantie 7 jours.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--pmu-gold)] px-2.5 py-1 text-xs font-black text-black">-66%</span>
                </div>
                <Link href={checkoutHref} className="app-button-primary mt-4 w-full min-h-12">
                  Activer mon accès PRO
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

        {/* Examples */}
        <section className="grid gap-4 md:grid-cols-3">
          {PREMIUM_EXAMPLES.map((example) => (
            <article key={example.title} className="app-card overflow-hidden p-0">
              <div className={`px-5 py-3 text-xs font-black uppercase tracking-wider ${
                example.tone === "play"
                  ? "bg-[var(--pmu-primary)] text-[var(--pmu-on-primary)]"
                  : example.tone === "pass"
                    ? "bg-[var(--pmu-surface-2)] text-[var(--pmu-text-muted)]"
                    : "bg-[var(--pmu-gold-light)] text-[var(--pmu-gold)]"
              }`}>
                {example.badge} · {example.title}
              </div>
              <div className="p-5">
                <h2 className="text-xl font-black text-[var(--pmu-text)]">{example.horse}</h2>
                <div className="mt-4 grid gap-2">
                  <div className="stake-chip px-4 py-3">
                    <p className="app-label text-[var(--pmu-gold)]">Mise conseillée</p>
                    <p className="mt-1 text-2xl font-black text-[var(--pmu-text)]">{example.stake}</p>
                  </div>
                  <div className="result-chip px-4 py-3">
                    <p className="app-label">Gain potentiel</p>
                    <p className="mt-1 text-2xl font-black text-[var(--pmu-primary)]">
                      {example.gain ?? weeklyGain}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--pmu-text-soft)]">
                  {example.title === "Semaine suivie" ? weeklyDetail : example.detail}
                </p>
              </div>
            </article>
          ))}
        </section>

        <PremiumDecisionStrip />

        {/* Features */}
        <section className="app-card p-5 md:p-6">
          <div className="app-section-heading">
            <div>
              <p className="app-kicker">Ce que Premium débloque</p>
              <h2 className="app-section-title">Moins d&apos;hésitation, plus de cadre.</h2>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="group rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-5 transition-all duration-200 hover:border-[var(--pmu-primary)] hover:shadow-[0_4px_20px_rgba(7,94,54,0.10)]">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{feature.icon}</span>
                  <span className="turf-decision-badge" data-tone="success">{feature.label}</span>
                </div>
                <h3 className="mt-3 text-lg font-black leading-tight text-[var(--pmu-text)]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Comparison table */}
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
              <div className="flex justify-center"><AvailabilityCell value={row.free} /></div>
              <div className="flex justify-center"><AvailabilityCell value={row.premium} /></div>
            </div>
          ))}
        </section>

        {/* Testimonials */}
        <section className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <article key={item.name} className="app-card flex flex-col justify-between p-5">
              <div>
                <Stars count={item.stars} />
                <p className="mt-4 text-base font-bold leading-7 text-[var(--pmu-text)]">
                  &quot;{item.quote}&quot;
                </p>
              </div>
              <div className="mt-5 border-t border-[var(--pmu-border)] pt-4">
                <p className="text-sm font-black text-[var(--pmu-primary)]">{item.name}</p>
                <p className="mt-0.5 text-xs text-[var(--pmu-text-muted)]">{item.location}</p>
              </div>
            </article>
          ))}
        </section>

        {/* Final CTA */}
        <section className="app-page-hero p-6 text-center md:p-9">
          <p className="app-kicker">Offre limitée</p>
          <h2 className="mx-auto mt-2 max-w-3xl text-3xl font-black leading-tight text-[var(--pmu-text)] md:text-5xl">
            Les premiers abonnés gardent le tarif fondateur.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)]">
            Premium est fait pour les parieurs qui veulent une décision nette avant
            le départ : JOUER, PASSER, mise, gain potentiel.
          </p>
          <div className="mx-auto mt-5 max-w-xl rounded-xl border border-[var(--pmu-gold)] bg-[var(--pmu-gold-light)] px-5 py-4">
            <p className="text-sm font-black text-[var(--pmu-text)]">
              🛡️ Garantie 7 jours : si TurfEdge ne t&apos;aide pas à mieux trier tes courses, remboursement immédiat, aucune question.
            </p>
          </div>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={checkoutHref} className="app-button-primary min-h-12 w-full sm:w-auto">
              Prendre Premium · {priceLabel}
            </Link>
            <Link href="/" className="app-button-secondary min-h-12 w-full sm:w-auto">
              Voir les courses du jour
            </Link>
          </div>
        </section>

        {/* FAQ + Referral */}
        <section className="grid gap-4 md:grid-cols-[0.9fr,1.1fr]">
          <div><ReferralCard /></div>
          <div className="app-card p-5 md:p-6">
            <p className="app-kicker">Questions fréquentes</p>
            <div className="mt-4 grid gap-3">
              {FAQ_ITEMS.map((item) => (
                <article key={item.q} className="rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
                  <h3 className="text-base font-black text-[var(--pmu-text)]">{item.q}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{item.a}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
