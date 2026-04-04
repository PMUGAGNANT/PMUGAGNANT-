import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ResultsDashboard } from "@/components/ui/ResultsDashboard";

const RESULTS_URL = "https://pmugagnant.vercel.app/resultats";
const RESULTS_TITLE = "Résultats réels — PMU Gagnant";
const RESULTS_DESCRIPTION =
  "Performances vérifiables : taux de réussite, ROI, historique complet. Gains ET pertes, en toute transparence.";

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="app-card overflow-hidden p-6 md:p-8">
        <div className="grid gap-5 xl:grid-cols-[1.08fr,0.92fr] xl:items-end">
          <div>
            <p className="app-kicker">Transparence publique</p>
            <h1 className="mt-2 text-4xl font-black leading-[0.94] tracking-tight text-[var(--pmu-text)] md:text-6xl">
              Nos résultats, sans filtre
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
              Douze mois de tickets recalculés, gains et pertes inclus. Pas de faux screenshots,
              pas de journées choisies après coup.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="app-pill app-pill--active">12 mois d&apos;historique</span>
              <span className="app-pill">Gains et pertes publiés</span>
              <span className="app-pill">Mise à jour quotidienne</span>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="app-card-muted px-5 py-4">
              <p className="app-label">Lecture rapide</p>
              <p className="mt-3 text-xl font-black text-[var(--pmu-primary)]">
                Une page pensée pour vérifier le moteur, pas pour enjoliver les résultats.
              </p>
            </div>
            <div className="app-card-muted px-5 py-4">
              <p className="text-sm leading-6 text-[var(--pmu-text-soft)]">
                La courbe ROI, les derniers tickets et les segments les plus rentables sont recalculés
                automatiquement à partir des tickets stockés.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<ResultsDashboardFallback />}>
        <ResultsDashboard />
      </Suspense>

      <section className="app-card-muted px-5 py-4 text-sm leading-6 text-[var(--pmu-text-soft)]">
        Les résultats antérieurs à avril 2026 sont issus d&apos;une simulation sur données historiques.
      </section>

      <section className="app-card p-6 text-center md:p-8">
        <p className="app-kicker">Passer à l&apos;action</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--pmu-text)] md:text-4xl">
          Convaincu ? Essayez gratuitement
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
          1 pronostic gratuit par jour • Pas de carte bancaire
        </p>
        <Link href="/login" className="app-button-primary mt-5 inline-flex">
          Essayer gratuitement →
        </Link>
      </section>
    </div>
  );
}
