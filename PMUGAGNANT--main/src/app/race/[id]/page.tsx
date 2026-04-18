import type { Metadata } from "next";
import { RaceAnalysisPage } from "@/features/vmax/RaceAnalysisPage";

export const metadata: Metadata = {
  title: "Analyse course - PMU Gagnant",
  description:
    "Analyse IA d'une course PMU : tableau des partants, scores, cotes, forme, mises conseillées et value bets.",
};

export default function RacePage() {
  return <RaceAnalysisPage />;
}
