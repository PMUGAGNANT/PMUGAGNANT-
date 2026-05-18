import Link from "next/link";

import SubscribeCheckoutButton from "@/features/subscribe/SubscribeCheckoutButton";
import { getPerformanceDateRange } from "@/features/performance/performance-model";
import { getTodayDateStr } from "@/lib/date-utils";
import { listPredictionsBetween, listPredictionsByDate } from "@/lib/prediction-store";
import { logger } from "@/lib/server-logger";
import {
  buildSubscribeTeasers,
  computeSubscribeRoiSummary,
  formatSubscribeRoi,
  type SubscribeTeaser,
} from "@/lib/subscribe-metrics";
import type { PredictionRow } from "@/lib/types";

const TESTIMONIALS = [
  {
    name: "Marc, Lyon",
    quote:
      "Je ne cherche plus pendant une heure. Je regarde la course, la mise, puis je decide.",
  },
  {
    name: "Nadia, Nantes",
    quote:
      "Le plus rentable pour moi, c'est surtout les courses que TurfEdge me dit de laisser.",
  },
  {
    name: "Thomas, Bordeaux",
    quote:
      "Le Telegram prive me permet de ne pas rater les alertes fortes avant le depart.",
  },
];

function formatEuros(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

async function safeLoadTodayPredictions() {
  try {
    return await listPredictionsByDate(getTodayDateStr());
  } catch (error) {
    logger.warn("subscribe.today_predictions_unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [] as PredictionRow[];
  }
}

async function safeLoadHistoryPredictions() {
  const { startIso, endIso } = getPerformanceDateRange("30j");
  try {
    return await listPredictionsBetween(startIso, endIso);
  } catch (error) {
    logger.warn("subscribe.history_predictions_unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [] as PredictionRow[];
  }
}

function EmptyTeaser() {
  return (
    <article className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
      <p className="app-kicker">Analyse du jour</p>
      <h3 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
        Les pronos arrivent
      </h3>
      <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
        Le cron du matin remplit automatiquement les selections visibles ici.
      </p>
    </article>
  );
}

function TeaserCard({ teaser, checkoutHref }: { teaser: SubscribeTeaser; checkoutHref: string }) {
  return (
    <article className="relative overflow-hidden rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.20)]">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-[var(--pmu-gold)] px-3 py-1 text-xs font-black uppercase text-black">
          {teaser.raceLabel}
        </span>
        <span className="text-xs font-black uppercase text-[var(--pmu-text-muted)]">
          {teaser.betType ?? "Signal"}
        </span>
      </div>
      <p className="mt-4 text-sm font-bold text-[var(--pmu-text-soft)]">
        {teaser.hippodrome}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--pmu-gold)] bg-[var(--pmu-gold-light)] text-xl font-black text-[var(--pmu-gold)]">
          {teaser.dossard}
        </span>
        <h3 className="min-w-0 select-none truncate text-2xl font-black leading-tight text-[var(--pmu-text)] blur-sm">
          {teaser.cheval}
        </h3>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-3">
          <p className="app-label">Confiance</p>
          <p className="mt-1 text-2xl font-black text-[var(--pmu-primary)]">
            {teaser.confidence.toFixed(0)}%
          </p>
        </div>
        <div className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-3">
          <p className="app-label">Mise conseillée</p>
          <p className="mt-1 select-none text-2xl font-black text-[var(--pmu-gold)] blur-sm">●●€</p>
        </div>
      </div>
      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--pmu-surface)]/60 backdrop-blur-[2px]">
        <span className="text-2xl">🔒</span>
        <Link
          href={checkoutHref}
          className="app-button-primary !py-2 !text-xs"
        >
          Débloquer · 9.99€/mois
        </Link>
      </div>
    </article>
  );
}

export default async function SubscribePage() {
  const [todayRows, historyRows] = await Promise.all([
    safeLoadTodayPredictions(),
    safeLoadHistoryPredictions(),
  ]);
  const teasers = buildSubscribeTeasers(todayRows);
  const roi = computeSubscribeRoiSummary(historyRows);
  const roiLabel = roi.bets > 0 ? formatSubscribeRoi(roi.roi) : "En cours";
  const checkoutHref = "/mes-paris?billing=checkout";

  return (
    <main className="mx-auto flex w-full max-w-[76rem] flex-col gap-7 px-4 pb-16">
      <section className="app-page-hero overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[1.04fr,0.96fr]">
          <div className="p-6 md:p-10">
            <div className="flex flex-wrap gap-2">
              <span className="turf-decision-badge" data-tone="success">
                Acces complet
              </span>
              <span className="turf-decision-badge" data-tone="warning">
                Telegram prive inclus
              </span>
            </div>
            <p className="app-kicker mt-7">TurfEdge PRO</p>
            <h1 className="mt-3 max-w-3xl text-[2.65rem] font-black leading-[0.94] text-[var(--pmu-text)] md:text-[5rem]">
              Les bons tickets, avant tout le monde.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--pmu-text-soft)]">
              Chaque matin, TurfEdge trie les courses, sort les meilleurs pronos,
              calcule la mise conseillee et envoie les alertes fortes dans le
              groupe Telegram prive.
            </p>

            <div className="mt-7 max-w-sm">
              <SubscribeCheckoutButton />
            </div>
            <p className="mt-3 text-sm font-bold text-[var(--pmu-text-muted)]">
              Paiement securise Stripe. Acces immediat apres confirmation.
            </p>
          </div>

          <div className="border-t border-[var(--pmu-border)] bg-[var(--pmu-primary-fade)] p-5 lg:border-l lg:border-t-0">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-lg border border-[var(--pmu-gold)] bg-[var(--pmu-gold-light)] p-5">
                <p className="app-kicker text-[var(--pmu-gold)]">ROI 30 jours</p>
                <p className="mt-2 text-5xl font-black leading-none text-[var(--pmu-text)]">
                  {roiLabel}
                </p>
                <p className="mt-3 text-sm font-bold text-[var(--pmu-text-soft)]">
                  {roi.bets > 0
                    ? `${roi.bets} tickets mesures, bilan ${formatEuros(roi.netGain)}`
                    : "Les resultats se remplissent avec les courses notees."}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-5">
                <p className="app-kicker">Prix fondateur</p>
                <p className="mt-2 text-5xl font-black leading-none text-[var(--pmu-text)]">
                  9.99 EUR
                </p>
                <p className="mt-2 text-sm font-bold text-[var(--pmu-text-muted)]">
                  par mois, sans engagement
                </p>
              </div>
              <div className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-5">
                <p className="app-kicker">Inclus</p>
                <p className="mt-2 text-lg font-black leading-7 text-[var(--pmu-text)]">
                  Acces complet au site, mises Kelly, value bets et Telegram prive.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
        <div className="app-card p-5 md:p-6">
          <p className="app-kicker">Teaser du jour</p>
          <h2 className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
            Les 3 derniers pronos detectes.
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
            Tu vois le signal. En PRO, tu obtiens aussi la mise exacte, le plan
            de jeu et les alertes Telegram avant le depart.
          </p>
          <div className="mt-5">
            <SubscribeCheckoutButton
              label="Debloquer les mises 9.99 EUR/mois"
              className="app-button-primary min-h-12 w-full justify-center"
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
          {teasers.length > 0
            ? teasers.map((teaser) => <TeaserCard key={teaser.id} teaser={teaser} checkoutHref={checkoutHref} />)
            : [0, 1, 2].map((item) => <EmptyTeaser key={item} />)}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["1", "Tu ouvres la course", "La decision JOUER ou PASSER est lisible en quelques secondes."],
          ["2", "Tu suis la mise", "Bankroll 100 EUR, Kelly fractionne, mise plafonnee et claire."],
          ["3", "Tu recois l'alerte", "Les signaux forts partent dans le Telegram prive avant le depart."],
        ].map(([step, title, text]) => (
          <article key={step} className="app-card p-5">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--pmu-gold)] text-lg font-black text-black">
              {step}
            </span>
            <h3 className="mt-4 text-2xl font-black text-[var(--pmu-text)]">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">{text}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {TESTIMONIALS.map((item) => (
          <article key={item.name} className="app-card p-5">
            <p className="text-lg font-black leading-7 text-[var(--pmu-text)]">
              &quot;{item.quote}&quot;
            </p>
            <p className="mt-4 text-sm font-bold text-[var(--pmu-primary)]">{item.name}</p>
            <p className="mt-1 text-xs text-[var(--pmu-text-muted)]">
              Temoignage illustratif
            </p>
          </article>
        ))}
      </section>

      <section className="app-page-hero p-6 text-center md:p-10">
        <p className="app-kicker">Acces PRO</p>
        <h2 className="mx-auto mt-2 max-w-3xl text-3xl font-black leading-tight text-[var(--pmu-text)] md:text-5xl">
          9.99 EUR/mois pour transformer le programme PMU en decisions nettes.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)]">
          L&apos;abonnement active tout le site et prepare automatiquement ton
          invitation au Telegram prive apres paiement Stripe.
        </p>
        <div className="mx-auto mt-6 max-w-sm">
          <SubscribeCheckoutButton label="Souscrire 9.99 EUR/mois" />
        </div>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex text-sm font-bold text-[var(--pmu-text-muted)] underline underline-offset-4"
        >
          Voir le dashboard avant de souscrire
        </Link>
      </section>
    </main>
  );
}
