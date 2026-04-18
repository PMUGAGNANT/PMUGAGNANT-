import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resultats PMU - TurfEdge",
  description:
    "Resultats PMU et suivi des performances TurfEdge pour comparer pronostics, scores IA, gains et pertes.",
};

export { default } from "@/features/results/ResultsPage";
