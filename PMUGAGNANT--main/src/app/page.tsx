import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PMU Gagnant - Lire une course en 30 secondes",
  description:
    "PMU Gagnant t'aide a comprendre vite la course, les chevaux importants, les outsiders, les profils a ecarter et quand il vaut mieux passer.",
  openGraph: {
    title: "PMU Gagnant - Lire une course en 30 secondes",
    description:
      "Une entree claire pour comprendre quoi jouer, quoi surveiller et quoi ignorer avant d'ouvrir le ticket detaille.",
  },
};

export const dynamic = "force-dynamic";

export { default } from "@/features/home/HomePage";
