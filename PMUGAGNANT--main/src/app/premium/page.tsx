import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Premium TurfEdge - Pronostics PMU IA complets",
  description:
    "Debloquez les pronostics premium TurfEdge: confiance detaillee, mises conseillees, alertes prioritaires et suivi ROI.",
  openGraph: {
    title: "Premium TurfEdge",
    description:
      "Acces aux meilleures courses, alertes et mises conseillees pour suivre les decisions PMU les plus nettes.",
  },
};

export { default } from "@/features/premium/PremiumPage";
