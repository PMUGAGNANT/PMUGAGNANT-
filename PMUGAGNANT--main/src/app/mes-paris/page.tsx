import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mes paris PMU - TurfEdge",
  description:
    "Espace personnel TurfEdge pour enregistrer tes tickets PMU, suivre tes mises, tes gains et ton abonnement.",
  robots: { index: false, follow: false },
};

export { default } from "@/features/account/BetsPage";
