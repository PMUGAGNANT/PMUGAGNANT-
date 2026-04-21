import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, DM_Sans, Roboto_Mono } from "next/font/google";
import { ComboPanel, ComboProvider } from "@/components/ComboBuilder";
import { AppShell } from "@/features/layout/components/AppShell";
import { GlossaryPanel } from "@/components/ui/Glossary";
import { PriorityRacePushScheduler } from "@/components/ui/PriorityRacePushScheduler";
import { ResponsibleGamingBar } from "@/components/ui/ResponsibleGamingBar";
import { ServiceWorkerRegistration } from "@/components/ui/ServiceWorkerRegistration";
import { ThemeMetaColor } from "@/components/ui/ThemeMetaColor";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import "./globals.css";

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const siteUrl =
  configuredSiteUrl?.startsWith("http") ? configuredSiteUrl : "https://pmugagnant.fr";
const defaultOgImage = "/promo-poster.jpg";

const uiFont = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
  weight: ["400", "500", "700", "800"],
});

const displayFont = Barlow_Condensed({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const monoFont = Roboto_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "TurfEdge",
  creator: "PMU Gagnant",
  publisher: "PMU Gagnant",
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
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/logo-turfedge.png",
    apple: "/logo-turfedge.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "TurfEdge - L'IA qui lit les courses PMU à ta place",
    description:
      "Analyse IA de toutes les courses PMU. Score de confiance, ticket optimisé, signal T-10min. Essai gratuit.",
    url: siteUrl,
    siteName: "TurfEdge",
    type: "website",
    locale: "fr_FR",
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: "TurfEdge analyse les courses PMU avec l'IA",
      },
    ],
  },
  twitter: {
    images: [defaultOgImage],
    card: "summary_large_image",
    title: "TurfEdge - L'IA qui lit les courses PMU",
    description:
      "Score de confiance, ticket optimisé, signal T-10min. IA hippique actionnable.",
  },
  appleWebApp: {
    title: "TurfEdge",
    capable: true,
    statusBarStyle: "black-translucent",
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
          <ResponsibleGamingBar />
          <ComboProvider>
            <ThemeMetaColor />
            <ServiceWorkerRegistration />
            <PriorityRacePushScheduler />
            <AppShell>{children}</AppShell>
            <GlossaryPanel />
            <ComboPanel />
          </ComboProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
