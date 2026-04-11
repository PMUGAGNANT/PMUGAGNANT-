import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import Script from "next/script";
import { AppShell } from "@/features/layout/components/AppShell";
import { GlossaryPanel } from "@/components/ui/Glossary";
import { OnboardingModal } from "@/components/ui/OnboardingModal";
import { PushNotificationPrompt } from "@/components/ui/PushNotificationPrompt";
import { ServiceWorkerRegistration } from "@/components/ui/ServiceWorkerRegistration";
import { ThemeMetaColor } from "@/components/ui/ThemeMetaColor";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import "./globals.css";

const uiFont = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
});

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PMU Gagnant | Radar PMU et decisions de course",
  description:
    "PMU Gagnant aide a reperer les meilleures courses PMU chaque jour avec une lecture claire, rapide et disciplinee.",
  manifest: "/manifest.json",
  openGraph: {
    title: "PMU Gagnant | Radar PMU et decisions de course",
    description:
      "PMU Gagnant aide a reperer les meilleures courses PMU chaque jour avec une lecture claire, rapide et disciplinee.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#f3f6fb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" data-theme="warm">
      <body
        className={`${uiFont.variable} ${displayFont.variable} min-h-screen text-[var(--pmu-text)] antialiased`}
      >
        <a href="#main-content" className="pmu-skip-link">
          Aller au contenu
        </a>
        <Script id="pmu-theme-init" strategy="beforeInteractive">
          {`(function(){try{var k='pmu-theme-v2';var v=localStorage.getItem(k);document.documentElement.setAttribute('data-theme',v==='dark'?'dark':'warm');}catch(e){document.documentElement.setAttribute('data-theme','warm');}})();`}
        </Script>
        <ThemeProvider>
          <ThemeMetaColor />
          <ServiceWorkerRegistration />
          <AppShell>{children}</AppShell>
          <OnboardingModal />
          <GlossaryPanel />
          <PushNotificationPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
