import type { Metadata } from "next";
import Link from "next/link";
import { PremiumValueBetsPanel } from "@/components/value-bets/PremiumValueBetsPanel";

export const metadata: Metadata = {
  title: "Chevaux du jour - PMU Gagnant",
  description:
    "Chevaux du jour PMU Gagnant : verdict VMAX, analyse détaillée, résultats d'hier, calendrier semaine et value bets premium.",
};

export const dynamic = "force-dynamic";

export default function ValueBetsPage() {
  return (
    <main className="value-page">
      <section className="value-shell">
        <header className="value-hero">
          <Link href="/dashboard" className="value-back-link">
            Retour dashboard
          </Link>
          <h1>Chevaux du jour</h1>
          <p>
            Une page pour décider vite : le Top 3 VMAX, le pourquoi, les résultats
            d&apos;hier et la semaine à venir. Discipline d&apos;abord : une value bet
            n&apos;est jamais une garantie.
          </p>
        </header>

        <PremiumValueBetsPanel />
      </section>
    </main>
  );
}
