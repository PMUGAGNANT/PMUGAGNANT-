import type { Metadata } from "next";
import { VmaxDashboardPage } from "@/features/vmax/VmaxDashboardPage";

export const metadata: Metadata = {
  title: "Dashboard VMAX - PMU Gagnant",
  description:
    "Dashboard premium PMU Gagnant : Quinté du jour, courses prêtes, value bets et statistiques live.",
};

export default function DashboardPage() {
  return <VmaxDashboardPage />;
}
