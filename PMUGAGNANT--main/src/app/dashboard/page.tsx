import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - PMU Gagnant",
  description:
    "Dashboard PMU Gagnant : ticket prioritaire, programme du jour, radar et statistiques.",
  openGraph: {
    title: "Dashboard PMU Gagnant",
    description: "Programme du jour, ticket prioritaire, radar et ROI en temps réel.",
  },
};

export const dynamic = "force-dynamic";

export { default } from "@/features/home/HomePage";
