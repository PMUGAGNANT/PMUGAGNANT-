import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Abonnement active - TurfEdge PRO",
  description:
    "Confirmation de paiement TurfEdge PRO, activation de l'acces complet et invitation Telegram privee.",
  robots: {
    index: false,
    follow: false,
  },
};

export { default } from "@/features/subscribe/SubscribeSuccessPage";
