import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Résultats PMU - TurfEdge",
  description:
    "Résultats PMU et suivi des performances TurfEdge pour comparer pronostics, scores IA, gains et pertes.",
  openGraph: {
    title: "Résultats réels TurfEdge",
    description: "Taux de réussite, ROI et historique complet — gains comme pertes.",
  },
};

export { default } from "@/features/results/ResultsPage";
