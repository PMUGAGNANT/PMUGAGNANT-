import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TurfEdge - Dashboard IA VMAX",
  description:
    "Dashboard premium TurfEdge : Quinté du jour, courses prêtes, value bets et statistiques live.",
  openGraph: {
    title: "TurfEdge - Dashboard IA VMAX",
    description:
      "Une interface premium pour lire les courses PMU, repérer les value bets et agir vite.",
  },
};

export const dynamic = "force-dynamic";

export { default } from "./dashboard/page";
