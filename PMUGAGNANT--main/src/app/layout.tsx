import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost, Roboto_Mono } from "next/font/google";
import { ComboPanel, ComboProvider } from "@/components/ComboBuilder";
import { AppShell } from "@/features/layout/components/AppShell";
import { GlossaryPanel } from "@/components/ui/Glossary";
import { OnboardingModal } from "@/components/ui/OnboardingModal";
import { PushNotificationPrompt } from "@/components/ui/PushNotificationPrompt";
import { ServiceWorkerRegistration } from "@/components/ui/ServiceWorkerRegistration";
import { ThemeMetaColor } from "@/components/ui/ThemeMetaColor";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import "./globals.css";

const uiFont = Jost({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
  weight: ["300", "400", "500"],
});

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const monoFont = Roboto_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "TurfEdge - L'IA qui lit les courses PMU à ta place",
  description:
    "Chaque matin, TurfEdge analyse toutes les courses PMU et te dit exactement quoi jouer, quoi ignorer, et combien miser. Score de confiance, ticket optimisé, signal T-10min.",
  keywords: [
    "PMU",
    "pronostic",
    "turf",
    "hippique",
    "algorithme",
    "intelligence artificielle",
    "cheval",
    "course",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: "/logo-turfedge.png",
    apple: "/logo-turfedge.png",
  },
  openGraph: {
    title: "TurfEdge - L'IA qui lit les courses PMU à ta place",
    description:
      "Analyse IA de toutes les courses PMU. Score de confiance, ticket optimisé, signal T-10min. Essai gratuit.",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "TurfEdge - L'IA qui lit les courses PMU",
    description:
      "Score de confiance, ticket optimisé, signal T-10min. IA hippique actionnable.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FAF7EF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" data-theme="warm">
      <body
        className={`${uiFont.variable} ${displayFont.variable} ${monoFont.variable} min-h-screen text-[var(--pmu-text)] antialiased`}
      >
        <a href="#main-content" className="pmu-skip-link">
          Aller au contenu
        </a>
        <ThemeProvider>
          <ComboProvider>
            <ThemeMetaColor />
            <ServiceWorkerRegistration />
            <AppShell>{children}</AppShell>
            <OnboardingModal />
            <GlossaryPanel />
            <PushNotificationPrompt />
            <ComboPanel />
          </ComboProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
