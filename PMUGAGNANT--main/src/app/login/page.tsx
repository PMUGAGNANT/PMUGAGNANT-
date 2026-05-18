import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion - PMU Gagnant",
  description:
    "Connecte-toi à PMU Gagnant pour suivre tes paris PMU, tes alertes, ton historique et ton abonnement Premium.",
  robots: { index: false, follow: false },
};

export { default } from "@/features/account/LoginPage";
