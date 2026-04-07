import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import Script from "next/script";
import { AppShell } from "@/components/ui/AppShell";
import { GlossaryPanel } from "@/components/ui/Glossary";
import { LiveStatsBanner } from "@/components/ui/LiveStatsBanner";
import { OnboardingModal } from "@/components/ui/OnboardingModal";
import { PushNotificationPrompt } from "@/components/ui/PushNotificationPrompt";
import { ServiceWorkerRegistration } from "@/components/ui/ServiceWorkerRegistration";
import { ThemeMetaColor } from "@/components/ui/ThemeMetaColor";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "PMU Gagnant - Pronostics PMU assistés par IA",
  description: "PMU Gagnant aide à repérer les meilleures courses PMU chaque jour avec une lecture claire et disciplinée.",
  manifest: "/manifest.json",
  openGraph: {
    title: "PMU Gagnant - Pronostics PMU assistés par IA",
    description: "PMU Gagnant aide à repérer les meilleures courses PMU chaque jour avec une lecture claire et disciplinée.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#f7f2e8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${manrope.className} min-h-screen text-[var(--pmu-text)] antialiased`}>
        <a href="#main-content" className="pmu-skip-link">
          Aller au contenu
        </a>
        <LiveStatsBanner />
        <Script id="pmu-theme-init" strategy="beforeInteractive">
          {`(function(){try{var k='pmu-theme';var v=localStorage.getItem(k);if(v==='warm'||v==='dark'){document.documentElement.setAttribute('data-theme',v);}else{document.documentElement.setAttribute('data-theme','warm');}}catch(e){document.documentElement.setAttribute('data-theme','warm');}})();`}
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
