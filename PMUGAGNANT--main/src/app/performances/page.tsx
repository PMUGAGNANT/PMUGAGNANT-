import type { Metadata } from "next";
import PersonalPerformancesPage from "@/features/performance/PersonalPerformancesPage";

export const metadata: Metadata = {
  title: "Performances personnelles - TurfEdge",
  description:
    "Historique personnel des 30 derniers paris TurfEdge avec mise, cote, résultat, gain, perte et ROI.",
};

export default PersonalPerformancesPage;
