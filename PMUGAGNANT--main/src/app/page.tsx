import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PMU Gagnant - L'IA qui analyse les courses PMU",
  description:
    "Chaque jour, PMU Gagnant identifie les meilleurs chevaux et simplifie la decision avant de parier.",
};

const proofCards = [
  "Analyse IA en temps reel",
  "1 ticket prioritaire par jour",
  "Alertes T-15min avant la course",
];

function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-3" aria-label="PMU Gagnant">
      <span className="grid h-12 w-12 place-items-center rounded-lg bg-[var(--pmu-primary)] font-black text-black">
        PG
      </span>
      <span>
        <span className="block font-[var(--font-display)] text-3xl font-black leading-none text-[var(--pmu-text)]">
          PMU<span className="text-[var(--pmu-primary)]">Gagnant</span>
        </span>
        <span className="text-xs font-black uppercase tracking-[0.18em] text-[var(--pmu-text-muted)]">
          L&apos;IA qui trie les courses
        </span>
      </span>
    </Link>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--pmu-bg)] text-[var(--pmu-text)]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5">
        <Brand />
        <nav className="flex items-center gap-2" aria-label="Navigation publique">
          <Link href="/login" className="app-button-secondary min-h-11">
            Se connecter
          </Link>
          <Link href="/signup" className="app-button-primary min-h-11">
            Commencer gratuitement
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 md:py-20">
        <div className="max-w-4xl">
          <p className="app-kicker">Pronostic PMU assiste par IA</p>
          <h1 className="mt-5 max-w-4xl font-[var(--font-display)] text-[3.25rem] font-black leading-[0.92] text-[var(--pmu-text)] md:text-[5.6rem]">
            L&apos;IA qui analyse les courses PMU a votre place
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--pmu-text-soft)]">
            Chaque jour, notre algorithme identifie les meilleurs chevaux. Vous
            pariez en confiance.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="app-button-primary min-h-12">
              Commencer gratuitement
            </Link>
            <Link href="/login" className="app-button-secondary min-h-12">
              Se connecter
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.05fr,0.95fr]">
          <article className="app-page-hero p-6 md:p-8">
            <p className="app-label">Stat cle</p>
            <strong className="mt-3 block font-[var(--font-display)] text-6xl font-black leading-none text-[var(--pmu-primary)] md:text-8xl">
              +26%
            </strong>
            <p className="mt-3 text-lg font-black text-[var(--pmu-text)]">
              ROI moyen sur 30 jours
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--pmu-text-soft)]">
              Une lecture courte, un ticket prioritaire, et moins de bruit avant
              de jouer.
            </p>
          </article>

          <div className="grid gap-3">
            {proofCards.map((item) => (
              <article key={item} className="app-card p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--pmu-primary)] font-black text-black">
                    OK
                  </span>
                  <h2 className="text-lg font-black text-[var(--pmu-text)]">{item}</h2>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-16">
        <div className="app-card flex flex-col items-start justify-between gap-5 p-6 md:flex-row md:items-center md:p-8">
          <div>
            <p className="app-kicker">Essai gratuit</p>
            <h2 className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
              Rejoignez PMU Gagnant - Essai gratuit
            </h2>
          </div>
          <Link href="/signup" className="app-button-primary min-h-12">
            S&apos;inscrire
          </Link>
        </div>
      </section>
    </main>
  );
}
