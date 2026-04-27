import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageNextStepCard } from "@/components/ui/PageNextStepCard";
import { ResultsDashboard } from "@/components/ui/ResultsDashboard";

const RESULTS_URL = "https://pmugagnant.vercel.app/resultats";
const RESULTS_TITLE = "Resultats reels | TurfEdge";
const RESULTS_DESCRIPTION =
  "Performances verifiables : taux de reussite, ROI et historique complet, gains comme pertes.";

export const metadata: Metadata = {
  title: RESULTS_TITLE,
  description: RESULTS_DESCRIPTION,
  openGraph: {
    title: RESULTS_TITLE,
    description: RESULTS_DESCRIPTION,
    url: RESULTS_URL,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: RESULTS_TITLE,
    description: RESULTS_DESCRIPTION,
  },
};

function ResultsDashboardFallback() {
  return (
    <div className="grid gap-6">
      <div className="app-card h-[220px] animate-pulse bg-[color-mix(in_srgb,var(--pmu-surface-2)_76%,transparent)]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="app-card h-48 animate-pulse bg-[color-mix(in_srgb,var(--pmu-surface-2)_76%,transparent)]"
          />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="app-card h-40 animate-pulse bg-[color-mix(in_srgb,var(--pmu-surface-2)_76%,transparent)]"
          />
        ))}
      </div>
      <div className="app-card h-[360px] animate-pulse bg-[color-mix(in_srgb,var(--pmu-surface-2)_76%,transparent)]" />
      <div className="app-card h-[360px] animate-pulse bg-[color-mix(in_srgb,var(--pmu-surface-2)_76%,transparent)]" />
    </div>
  );
}

export default function ResultatsPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: RESULTS_TITLE,
    description: RESULTS_DESCRIPTION,
    url: RESULTS_URL,
  };

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="app-page-hero p-6 md:p-8">
        <div className="relative z-[1] grid gap-6 xl:grid-cols-[1.08fr,0.92fr] xl:items-end">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[var(--pmu-primary-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--pmu-primary)]">
                Transparence publique
              </span>
              <span className="app-pill text-xs">12 mois d&apos;historique</span>
              <span className="app-pill text-xs">Gains et pertes publies</span>
            </div>

            <div>
              <p className="app-kicker">Resultats reels</p>
              <h1 className="max-w-4xl text-4xl font-black leading-[0.93] text-[var(--pmu-text)] md:text-6xl">
                Une page faite pour verifier le moteur, pas pour enjoliver les chiffres.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
                Douze mois de tickets recalcules, gains et pertes inclus. Pas de faux
                screenshots, pas de journees choisies apres coup.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/premium" className="app-button-primary">
                Voir l&apos;offre premium
              </Link>
              <Link href="/bilan" className="app-button-secondary">
                Ouvrir le bilan detaille
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="app-stat-card px-5 py-4">
              <p className="app-label">Lecture rapide</p>
              <p className="mt-3 text-xl font-black text-[var(--pmu-primary)]">
                Une page pensee pour controler le moteur, pas pour raconter une belle histoire.
              </p>
            </div>
            <div className="app-card-muted px-5 py-4 text-sm leading-7 text-[var(--pmu-text-soft)]">
              La courbe ROI, les derniers tickets et les segments les plus rentables sont
              recalcules automatiquement a partir des tickets stockes.
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<ResultsDashboardFallback />}>
        <ResultsDashboard />
      </Suspense>

      <section className="app-card-muted px-5 py-4 text-sm leading-7 text-[var(--pmu-text-soft)]">
        Les resultats anterieurs a avril 2026 proviennent d&apos;une simulation sur
        donnees historiques.
      </section>

      <PageNextStepCard
        kicker="Passer a l'action"
        title="Verifier les chiffres, puis ouvrir une vraie course"
        text="Les resultats servent a valider le moteur. L'etape utile ensuite, c'est d'aller sur le dashboard pour lire les courses du jour ou d'ouvrir l'offre premium si tu veux les tickets complets."
        primaryHref="/dashboard"
        primaryLabel="Ouvrir le dashboard"
        secondaryHref="/premium"
        secondaryLabel="Voir l'offre premium"
      />
    </div>
  );
}
