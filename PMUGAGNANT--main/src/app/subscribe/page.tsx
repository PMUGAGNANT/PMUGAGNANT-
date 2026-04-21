import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "S'abonner TurfEdge PRO - Pronostics IA et Telegram prive",
  description:
    "Abonnez-vous a TurfEdge PRO pour debloquer les pronostics IA complets, les mises conseillees, le ROI 30 jours et le Telegram prive.",
  openGraph: {
    title: "TurfEdge PRO",
    description:
      "Pronostics IA, mises conseillees et alertes Telegram privees pour jouer moins de courses, mais mieux selectionnees.",
  },
};

export const dynamic = "force-dynamic";

export { default } from "@/features/subscribe/SubscribePage";
