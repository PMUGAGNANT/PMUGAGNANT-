import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TurfEdge - Pronostics PMU IA avec mises conseillees",
  description:
    "TurfEdge analyse les courses PMU avec l'IA, affiche le cheval a jouer, la confiance, la mise conseillee et le gain potentiel.",
  openGraph: {
    title: "TurfEdge - L'IA qui transforme les courses PMU en decisions claires",
    description:
      "Pronostics PMU lisibles, mise conseillee, ROI suivi et signaux de confiance pour jouer moins au hasard.",
  },
};

export { default } from "@/features/home/HomePage";
