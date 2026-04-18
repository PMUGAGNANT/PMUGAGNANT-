import type { Metadata } from "next";
import { VmaxDashboardPage } from "@/features/vmax/VmaxDashboardPage";

export const metadata: Metadata = {
  title: "PMU Gagnant - Dashboard IA VMAX",
  description:
    "Dashboard premium PMU Gagnant : Quinté du jour, courses prêtes, value bets et statistiques live.",
  openGraph: {
    title: "PMU Gagnant - Dashboard IA VMAX",
    description:
      "Une interface premium pour lire les courses PMU, repérer les value bets et agir vite.",
  },
};

export default function HomePage() {
  return <VmaxDashboardPage />;
}
