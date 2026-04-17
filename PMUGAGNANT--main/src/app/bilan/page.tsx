import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bilan TurfEdge - ROI, gains et calibration PMU",
  description:
    "Suivez le ROI TurfEdge sur 7, 30 et 90 jours, comparez les mises conseillees aux gains et exportez votre bilan mensuel.",
  openGraph: {
    title: "Bilan TurfEdge",
    description:
      "Tableau de bord ROI, performance algo, calibration et historique des pronostics PMU notes.",
  },
};

export { default } from "@/features/performance/BilanPage";
