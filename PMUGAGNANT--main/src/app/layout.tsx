import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, DM_Sans, Roboto_Mono } from "next/font/google";
import { ComboPanel, ComboProvider } from "@/components/ComboBuilder";
import { AppShell } from "@/features/layout/components/AppShell";
import { GlossaryPanel } from "@/components/ui/Glossary";
import { PriorityRacePushScheduler } from "@/components/ui/PriorityRacePushScheduler";
import { ResponsibleGamingBar } from "@/components/ui/ResponsibleGamingBar";
import { ServiceWorkerRegistration } from "@/components/ui/ServiceWorkerRegistration";
import { SiteBootSplash } from "@/components/ui/SiteBootSplash";
import { ThemeMetaColor } from "@/components/ui/ThemeMetaColor";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { TurfEdgeCoach } from "@/components/ui/TurfEdgeCoach";
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
  applicationName: "PMU Gagnant",
  creator: "PMU Gagnant",
  publisher: "PMU Gagnant",
  title: "PMU Gagnant - L'IA qui trie les courses PMU",
  description:
    "Chaque matin, PMU Gagnant analyse les courses PMU, affiche les tickets jouables, les courses a eviter, la confiance IA et la mise conseillee.",
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
    title: "PMU Gagnant - L'IA qui trie les courses PMU",
    description:
      "Analyse IA de toutes les courses PMU. Score de confiance, ticket optimisé, signal T-10min. Essai gratuit.",
    url: siteUrl,
    siteName: "PMU Gagnant",
    type: "website",
    locale: "fr_FR",
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: "PMU Gagnant analyse les courses PMU avec l'IA",
      },
    ],
  },
  twitter: {
    images: [defaultOgImage],
    card: "summary_large_image",
    title: "PMU Gagnant - L'IA qui trie les courses PMU",
    description:
      "Courses triees, confiance IA, tickets jouables et courses a eviter.",
  },
  appleWebApp: {
    title: "PMU Gagnant",
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
    <html lang="fr" data-theme="warm" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('pmu-theme-v2');document.documentElement.dataset.theme=t==='cream'?'cream':'warm'}catch(e){}",
          }}
        />
      </head>
      <body
        className={`${uiFont.variable} ${displayFont.variable} ${monoFont.variable} min-h-screen text-[var(--pmu-text)] antialiased`}
      >
        <a href="#main-content" className="pmu-skip-link">
          Aller au contenu
        </a>
        <ThemeProvider>
          <SiteBootSplash />
          <ResponsibleGamingBar />
          <ComboProvider>
            <ThemeMetaColor />
            <ServiceWorkerRegistration />
            <PriorityRacePushScheduler />
            <AppShell>{children}</AppShell>
            <TurfEdgeCoach />
            <GlossaryPanel />
            <ComboPanel />
          </ComboProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
