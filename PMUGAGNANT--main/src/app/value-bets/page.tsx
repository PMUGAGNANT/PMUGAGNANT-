import type { Metadata } from "next";
import Link from "next/link";
import { PremiumValueBetsPanel } from "@/components/value-bets/PremiumValueBetsPanel";

export const metadata: Metadata = {
  title: "Value Bets du jour - TurfEdge",
  description:
    "Value bets PMU du jour detectees par l'IA TurfEdge, avec cote actuelle, cote fair et edge pour les membres Premium.",
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
          <h1>Value Bets du jour</h1>
          <p>
            Les chevaux dont la cote PMU semble superieure a la cote fair calculee par
            l&apos;IA. Discipline d&apos;abord : une value bet n&apos;est pas une garantie.
          </p>
        </header>

        <PremiumValueBetsPanel />
      </section>
    </main>
  );
}
