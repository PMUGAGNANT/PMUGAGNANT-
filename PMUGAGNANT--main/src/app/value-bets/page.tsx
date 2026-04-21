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
    <main className="min-h-screen bg-[#0A0E1A] px-4 py-6 text-[#F6F2E8]">
      <section className="mx-auto grid w-full max-w-[92rem] gap-5">
        <header className="rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-5 shadow-2xl shadow-black/25 md:p-7">
          <Link href="/dashboard" className="text-xs font-black uppercase text-[#D4AF37]">
            Retour dashboard
          </Link>
          <h1 className="mt-3 font-[var(--font-display)] text-5xl font-black leading-none md:text-7xl">
            Value Bets du jour
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-7 text-slate-400">
            Les chevaux dont la cote PMU semble superieure a la cote fair calculee par
            l&apos;IA. Discipline d&apos;abord : une value bet n&apos;est pas une garantie.
          </p>
        </header>

        <PremiumValueBetsPanel />
      </section>
    </main>
  );
}
